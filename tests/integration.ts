import { mediaIntegration } from "./media-integration.ts";
import { PrismaClient } from "../supabase/functions/_shared/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { ShopService } from "../supabase/functions/_shared/service.ts";
import {
  DeliverRestockNotificationsUseCase,
  type DeliveryConfig,
} from "../supabase/functions/_shared/restock/application/DeliverRestockNotificationsUseCase.ts";
import { createResendMailer } from "../supabase/functions/_shared/restock/infra/ResendMailer.ts";
import { AppError } from "../supabase/functions/_shared/domain.ts";
const url = Deno.env.get("TEST_DATABASE_URL");
if (
  !url ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
  !new URL(url).pathname.includes("test")
)
  throw new Error("Use a local disposable test database");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 10 }),
});
const shop = new ShopService(db);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function variant(stock = 1) {
  return db.productVariant.create({
    data: {
      size: "M",
      color: "Negro",
      sku: crypto.randomUUID(),
      stock,
      product: {
        create: {
          name: "Integration test",
          slug: crypto.randomUUID(),
          salePrice: "100.25",
        },
      },
    },
  });
}
const mail: DeliveryConfig = {
  siteUrl: "https://example.com",
  apiUrl: "https://api.example.com/functions/v1/api",
};
function deliverNotifications(send: typeof fetch, config = mail) {
  return new DeliverRestockNotificationsUseCase(
    db,
    createResendMailer({ apiKey: "test", from: "test@example.com" }, send),
    config
  ).execute();
}
const okSend = (async () => Response.json({ id: "test" })) as typeof fetch;
function order(variantId: string, quantity = 1) {
  return {
    idempotencyKey: crypto.randomUUID(),
    clientName: "Test",
    clientPhone: "5555555555",
    items: [{ variantId, quantity }],
  };
}
Deno.test({
  name: "PostgreSQL: atomic reservations, expiry, concurrency, outbox and RLS",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    try {
      // ADM-03: a conflict or archived row rolls back the entire multi-product batch.
      const bulk = [await variant(2), await variant(3)].sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      await shop.updateStock(
        bulk.map((v) => ({ id: v.id, version: v.version, stock: 8 }))
      );
      for (const v of bulk) {
        const actual = await db.productVariant.findUniqueOrThrow({
          where: { id: v.id },
        });
        assert(
          actual.stock === 8 && actual.version === 1,
          "bulk stock and version updated"
        );
      }
      for (const archived of [false, true]) {
        if (archived)
          await db.product.update({
            where: { id: bulk[1].productId },
            data: { isArchived: true },
          });
        let rejected = false;
        try {
          await shop.updateStock([
            { id: bulk[0].id, version: 1, stock: 10 },
            { id: bulk[1].id, version: archived ? 1 : 0, stock: 10 },
          ]);
        } catch (error) {
          rejected = error instanceof AppError && error.status === 409;
        }
        assert(rejected, "conflict or archived product rejects batch");
        assert(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: bulk[0].id },
            })
          ).stock === 8,
          "entire batch rolled back"
        );
      }
      await db.product.update({
        where: { id: bulk[1].productId },
        data: { isArchived: false },
      });
      await db.productVariant.update({
        where: { id: bulk[1].id },
        data: { isArchived: true },
      });
      let archivedVariantRejected = false;
      try {
        await shop.updateStock([{ id: bulk[1].id, version: 1, stock: 9 }]);
      } catch (error) {
        archivedVariantRejected =
          error instanceof AppError && error.status === 409;
      }
      assert(archivedVariantRejected, "archived variant rejects stock write");
      const v = await variant();
      const results = await Promise.allSettled([
        shop.createOrder(order(v.id)),
        shop.createOrder(order(v.id)),
      ]);
      assert(
        results.filter((r) => r.status === "fulfilled").length === 1,
        "overselling prevented"
      );
      assert(
        (await db.productVariant.findUniqueOrThrow({ where: { id: v.id } }))
          .stock === 0,
        "stock zero"
      );
      const succeeded = results.find((r) => r.status === "fulfilled");
      assert(succeeded?.status === "fulfilled", "order exists");
      const saved = succeeded.value;
      await Promise.all([
        shop.transition(saved.id, "CANCELLED"),
        shop.transition(saved.id, "CANCELLED"),
      ]);
      assert(
        (await db.productVariant.findUniqueOrThrow({ where: { id: v.id } }))
          .stock === 1,
        "cancellation restores once"
      );
      const cancelledHistory = await db.orderStatusHistory.findMany({
        where: { orderId: saved.id },
      });
      assert(
        cancelledHistory.length === 2,
        "one checkout and one cancellation despite concurrency"
      );
      const unchanged = await db.order.findUniqueOrThrow({
        where: { id: saved.id },
      });
      const replay = await shop.transition(saved.id, "CANCELLED");
      assert(
        replay.updatedAt.getTime() === unchanged.updatedAt.getTime(),
        "replay leaves updatedAt unchanged"
      );
      const actorId = crypto.randomUUID();
      const paidVariant = await variant(2);
      const paid = await shop.createOrder(order(paidVariant.id));
      await shop.transition(paid.id, "CONFIRMED", false, actorId);
      await db.order.update({
        where: { id: paid.id },
        data: { expiresAt: new Date(0) },
      });
      let expiredPaidRejected = false;
      try {
        await shop.transition(paid.id, "CANCELLED", true);
      } catch (e) {
        expiredPaidRejected = e instanceof AppError && e.status === 409;
      }
      assert(expiredPaidRejected, "cron cannot cancel confirmed order");
      await shop.transition(paid.id, "SHIPPED", false, actorId);
      const paidHistory = await db.orderStatusHistory.findMany({
        where: { orderId: paid.id, source: "MANUAL" },
      });
      assert(
        paidHistory.length === 2 &&
          paidHistory.every((e) => e.actorId === actorId),
        "authenticated actor preserved"
      );
      assert(
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: paidVariant.id },
          })
        ).stock === 1,
        "confirmation and shipping do not debit stock twice"
      );
      // Fail after state, history and stock writes: the outbox failure must roll all back.
      const rollbackVariant = await variant();
      const rollbackOrder = await shop.createOrder(order(rollbackVariant.id));
      class BrokenOutbox extends ShopService {
        override async enqueue(): Promise<void> {
          throw new Error("injected outbox failure");
        }
      }
      let rolledBack = false;
      try {
        await new BrokenOutbox(db).transition(rollbackOrder.id, "CANCELLED");
      } catch {
        rolledBack = true;
      }
      assert(rolledBack, "injected failure reached");
      assert(
        (await db.order.findUniqueOrThrow({ where: { id: rollbackOrder.id } }))
          .status === "PENDING_PAYMENT",
        "state rollback"
      );
      assert(
        (await db.orderStatusHistory.count({
          where: { orderId: rollbackOrder.id },
        })) === 1,
        "history rollback"
      );
      assert(
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: rollbackVariant.id },
          })
        ).stock === 0,
        "stock rollback"
      );
      const v2 = await variant(3);
      const payload = order(v2.id);
      const beforeCreation = Date.now();
      const repeated = await Promise.all([
        shop.createOrder(payload),
        shop.createOrder(payload),
      ]);
      assert(repeated[0].id === repeated[1].id, "idempotency");
      assert(
        (await db.orderStatusHistory.count({
          where: { orderId: repeated[0].id },
        })) === 1,
        "checkout replay has one history event"
      );
      const persisted = await db.order.findUniqueOrThrow({
        where: { id: repeated[0].id },
        include: { items: true },
      });
      assert(persisted.status === "PENDING_PAYMENT", "initial status");
      assert(persisted.currency === "MXN", "order currency");
      const holdMs = 24 * 60 * 60 * 1000;
      assert(
        persisted.expiresAt.getTime() >= beforeCreation + holdMs &&
          persisted.expiresAt.getTime() <= Date.now() + holdMs,
        "24-hour hold"
      );
      assert(persisted.totalAmount.toFixed(2) === "100.25", "database price");
      await db.product.update({
        where: { id: v2.productId },
        data: {
          name: "Renamed product",
          salePrice: "999.99",
        },
      });
      const replayed = await shop.createOrder(payload);
      const line = replayed.items[0];
      assert(
        line.productName === "Integration test" &&
          line.sku === v2.sku &&
          line.size === "M" &&
          line.color === "Negro" &&
          line.quantity === 1 &&
          line.price.toFixed(2) === "100.25" &&
          replayed.totalAmount.toFixed(2) === "100.25",
        "replay uses historical item data and prices"
      );
      assert(
        (await db.productVariant.findUniqueOrThrow({ where: { id: v2.id } }))
          .stock === 2,
        "replay does not reserve"
      );
      let rejected = false;
      try {
        await shop.createOrder({ ...payload, clientName: "Changed" });
      } catch (error) {
        rejected = error instanceof AppError && error.status === 409;
      }
      assert(rejected, "idempotency mismatch rejected");
      // Ensure an available line is reserved before the failing line is processed.
      const pair = [await variant(2), await variant(2)].sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      const [rollback, empty] = pair;
      await db.productVariant.update({
        where: { id: empty.id },
        data: { stock: 0 },
      });
      const failedPayload = order(rollback.id);
      let stockRejected = false;
      try {
        await shop.createOrder({
          ...failedPayload,
          items: [
            { variantId: rollback.id, quantity: 1 },
            { variantId: empty.id, quantity: 1 },
          ],
        });
      } catch (error) {
        stockRejected = error instanceof AppError && error.status === 409;
      }
      assert(stockRejected, "insufficient stock rejected");
      assert(
        (await db.order.count({
          where: { idempotencyKey: failedPayload.idempotencyKey },
        })) === 0,
        "failed order not persisted"
      );
      assert(
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: rollback.id },
          })
        ).stock === 2,
        "whole order rollback"
      );
      for (const archiveProduct of [false, true]) {
        const archived = await variant(2);
        if (archiveProduct) {
          await db.product.update({
            where: { id: archived.productId },
            data: { isArchived: true },
          });
        } else {
          await db.productVariant.update({
            where: { id: archived.id },
            data: { isArchived: true },
          });
        }
        const archivedPayload = order(archived.id);
        let rejected = false;
        try {
          await shop.createOrder(archivedPayload);
        } catch (error) {
          rejected = error instanceof AppError && error.status === 409;
        }
        assert(rejected, "archived product or variant rejected");
        assert(
          (await db.order.count({
            where: { idempotencyKey: archivedPayload.idempotencyKey },
          })) === 0,
          "archived order not persisted"
        );
        assert(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: archived.id },
            })
          ).stock === 2,
          "archived stock unchanged"
        );
      }
      await db.order.update({
        where: { id: repeated[0].id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await Promise.allSettled([
        shop.transition(repeated[0].id, "CONFIRMED"),
        shop.expire(),
      ]);
      assert(
        (await db.order.findUniqueOrThrow({ where: { id: repeated[0].id } }))
          .status === "CANCELLED",
        "expired payment cannot win"
      );
      assert(
        (await db.productVariant.findUniqueOrThrow({ where: { id: v2.id } }))
          .stock === 3,
        "expiry restores once"
      );
      assert(
        (await shop.expire()) === 0,
        "repeated expiry counts only effective changes"
      );
      assert(
        (await db.orderStatusHistory.count({
          where: { orderId: repeated[0].id, source: "EXPIRATION" },
        })) === 1,
        "one automatic event"
      );
      const raceVariant = await variant();
      const raceOrder = await shop.createOrder(order(raceVariant.id));
      await db.order.update({
        where: { id: raceOrder.id },
        data: { expiresAt: new Date(0) },
      });
      const expiryCounts = await Promise.all([shop.expire(), shop.expire()]);
      assert(
        expiryCounts.reduce((sum, count) => sum + count, 0) === 1,
        "concurrent jobs count cancellation once"
      );
      assert(
        (await db.orderStatusHistory.count({
          where: { orderId: raceOrder.id },
        })) === 2,
        "concurrent jobs record once"
      );
      assert(
        (await db.productVariant.findUniqueOrThrow({ where: { id: v2.id } }))
          .stock === 3,
        "expiry idempotent"
      );
      const subscribeStatus = async (variantId: string) => {
        try {
          await shop.subscribe("test@example.com", variantId, false);
          return 0;
        } catch (error) {
          return error instanceof AppError ? error.status : -1;
        }
      };
      assert(
        (await shop.subscribe("test@example.com", empty.id, false)) ===
          "created",
        "first subscription created"
      );
      assert(
        (await shop.subscribe("test@example.com", empty.id, false)) ===
          "active",
        "repeated subscription is idempotent"
      );
      assert(
        (await db.restockSubscription.count({
          where: { variantId: empty.id },
        })) === 1,
        "subscription deduplicated"
      );
      assert(
        (await subscribeStatus((await variant(2)).id)) === 409,
        "in-stock variant rejected"
      );
      assert(
        (await subscribeStatus(crypto.randomUUID())) === 404,
        "unknown variant is not found"
      );
      const archivedRestock = await variant(0);
      await db.productVariant.update({
        where: { id: archivedRestock.id },
        data: { isArchived: true },
      });
      assert(
        (await subscribeStatus(archivedRestock.id)) === 404,
        "archived variant is not found"
      );
      const racer = await variant(0);
      const raced = await Promise.all([
        shop.subscribe("race@example.com", racer.id, false),
        shop.subscribe("race@example.com", racer.id, false),
      ]);
      assert(
        raced.sort().join() === "active,created" &&
          (await db.restockSubscription.count({
            where: { variantId: racer.id },
          })) === 1,
        "concurrent duplicates resolve to one subscription"
      );
      await shop.updateStock([{ id: empty.id, version: 0, stock: 2 }]);
      assert((await db.notification.count()) === 1, "outbox enqueued");
      rejected = false;
      try {
        await shop.updateStock([{ id: empty.id, version: 0, stock: 9 }]);
      } catch {
        rejected = true;
      }
      assert(rejected, "stale inventory rejected");
      await deliverNotifications(
        (async () => new Response("", { status: 503 })) as typeof fetch
      );
      const notification = await db.notification.findFirstOrThrow();
      assert(
        notification.status === "PENDING" && notification.attempts === 1,
        "delivery retries persisted"
      );
      await db.notification.update({
        where: { id: notification.id },
        data: { availableAt: new Date(0) },
      });
      let calls = 0;
      let sentPayload: {
        html?: string;
        text?: string;
        headers?: Record<string, string>;
      } = {};
      await deliverNotifications((async (_url: string, init?: RequestInit) => {
        calls++;
        sentPayload = JSON.parse(String(init?.body));
        return Response.json({ id: "test" });
      }) as typeof fetch);
      await deliverNotifications((async () => {
        calls++;
        return Response.json({ id: "test" });
      }) as typeof fetch);
      assert(calls === 1, "sent messages not resent");
      const notified = await db.restockSubscription.findFirstOrThrow({
        where: { email: "test@example.com", variantId: empty.id },
      });
      assert(notified.status === "NOTIFIED", "delivery marks subscription");
      assert(
        !!sentPayload.html?.includes("Ver producto") &&
          !!sentPayload.text?.includes("/baja?token=") &&
          sentPayload.headers?.["List-Unsubscribe"] ===
            "<https://api.example.com/functions/v1/api/v1/unsubscribe/one-click?token=" +
              notified.unsubscribeToken +
              ">, <https://example.com/baja?token=" +
              notified.unsubscribeToken +
              ">" &&
          sentPayload.headers?.["List-Unsubscribe-Post"] ===
            "List-Unsubscribe=One-Click",
        "email has HTML, text and one-click List-Unsubscribe"
      );
      await db.productVariant.update({
        where: { id: empty.id },
        data: { stock: 0 },
      });
      assert(
        (await shop.subscribe("test@example.com", empty.id, false)) ===
          "reactivated",
        "notified subscription reactivates"
      );
      const sub = await db.restockSubscription.findUniqueOrThrow({
        where: { id: notified.id },
      });
      assert(
        sub.status === "ACTIVE" &&
          sub.generation === notified.generation + 1 &&
          sub.unsubscribeToken !== notified.unsubscribeToken,
        "reactivation rotates generation and token"
      );
      await shop.unsubscribe(sub.unsubscribeToken);
      assert(
        (
          await db.restockSubscription.findUniqueOrThrow({
            where: { id: sub.id },
          })
        ).status === "UNSUBSCRIBED",
        "unsubscribe persisted"
      );
      assert(
        (await shop.subscribe("test@example.com", empty.id, false)) ===
          "unsubscribed",
        "unsubscribed email needs consent"
      );
      assert(
        (
          await db.restockSubscription.findUniqueOrThrow({
            where: { id: sub.id },
          })
        ).status === "UNSUBSCRIBED",
        "consent prompt changes nothing"
      );
      assert(
        (await shop.subscribe("test@example.com", empty.id, true)) ===
          "reactivated",
        "explicit consent reactivates"
      );
      // LOG-06: waiting for stock never spends attempts nor ends as a false FAILED.
      const waiting = await variant(0);
      await shop.subscribe("wait@example.com", waiting.id, false);
      await shop.updateStock([{ id: waiting.id, version: 0, stock: 1 }]);
      await db.productVariant.update({
        where: { id: waiting.id },
        data: { stock: 0 },
      });
      const noticeOf = (variantId: string) =>
        db.notification.findFirstOrThrow({
          where: { subscription: { variantId } },
        });
      for (let i = 0; i < 6; i++) {
        await db.notification.update({
          where: { id: (await noticeOf(waiting.id)).id },
          data: { availableAt: new Date(0) },
        });
        await deliverNotifications(okSend);
      }
      let waited = await noticeOf(waiting.id);
      assert(
        waited.status === "PENDING" &&
          waited.attempts === 0 &&
          waited.firstAttemptAt === null &&
          waited.availableAt > new Date(),
        "stock waits do not count as attempts"
      );
      await db.notification.update({
        where: { id: waited.id },
        data: {
          availableAt: new Date(0),
          createdAt: new Date(Date.now() - 48 * 3600000),
        },
      });
      await db.productVariant.update({
        where: { id: waiting.id },
        data: { stock: 1 },
      });
      await deliverNotifications(okSend);
      waited = await noticeOf(waiting.id);
      assert(
        waited.status === "SENT" &&
          waited.attempts === 1 &&
          waited.firstAttemptAt !== null,
        "a long wait is delivered instead of failing"
      );
      // A permanent provider rejection fails at once; transient ones back off.
      const rejectedMail = await variant(0);
      await shop.subscribe("bad@example.com", rejectedMail.id, false);
      await shop.updateStock([{ id: rejectedMail.id, version: 0, stock: 1 }]);
      await deliverNotifications(
        (async () => new Response("", { status: 422 })) as typeof fetch
      );
      const bad = await noticeOf(rejectedMail.id);
      assert(
        bad.status === "FAILED" &&
          bad.attempts === 1 &&
          bad.firstAttemptAt !== null &&
          !!bad.lastError?.includes("422"),
        "permanent provider error fails immediately"
      );
      // Retries: safe inside the dedup window, explicit confirmation outside it.
      const retries = shop.restockRetries();
      await retries.retryOne(bad.id, false);
      let retried = await noticeOf(rejectedMail.id);
      assert(
        retried.status === "PENDING" &&
          retried.attempts === 0 &&
          retried.lastError === null,
        "retry inside the window requeues"
      );
      const uncertainAt = new Date(Date.now() - 30 * 3600000);
      await db.notification.update({
        where: { id: bad.id },
        data: {
          attempts: 1,
          firstAttemptAt: uncertainAt,
          availableAt: new Date(0),
        },
      });
      let uncertainCalls = 0;
      await deliverNotifications((async () => {
        uncertainCalls++;
        return Response.json({ id: "test" });
      }) as typeof fetch);
      retried = await noticeOf(rejectedMail.id);
      assert(
        retried.status === "FAILED" &&
          uncertainCalls === 0 &&
          !!retried.lastError?.startsWith("Entrega incierta"),
        "uncertain delivery is not resent automatically"
      );
      let needsConfirmation = 0;
      try {
        await retries.retryOne(bad.id, false);
      } catch (error) {
        needsConfirmation = error instanceof AppError ? error.status : -1;
      }
      assert(needsConfirmation === 409, "uncertain retry needs confirmation");
      assert(
        (await retries.retryAllReady()).count === 0,
        "bulk retry skips uncertain notices"
      );
      await retries.retryOne(bad.id, true);
      retried = await noticeOf(rejectedMail.id);
      assert(
        retried.status === "PENDING" && retried.firstAttemptAt === null,
        "forced retry opens a new dedup window"
      );
      await db.notification.update({
        where: { id: bad.id },
        data: {
          status: "FAILED",
          attempts: 1,
          firstAttemptAt: new Date(),
          lastError: "Resend rechazó el correo (HTTP 422)",
        },
      });
      assert(
        (await retries.retryAllReady()).count === 1,
        "bulk retry requeues safe notices"
      );
      await db.notification.update({
        where: { id: bad.id },
        data: {
          status: "FAILED",
          attempts: 1,
          firstAttemptAt: new Date(),
          lastError: "Resend rechazó el correo (HTTP 422)",
        },
      });
      // Unarchiving re-enqueues and revives notices cancelled by the archive.
      const archived = await variant(0);
      await shop.subscribe("arch@example.com", archived.id, false);
      await shop.updateStock([{ id: archived.id, version: 0, stock: 2 }]);
      const versionOf = async (variantId: string) =>
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: variantId },
          })
        ).version;
      const productVersion = async () =>
        (
          await db.product.findUniqueOrThrow({
            where: { id: archived.productId },
          })
        ).version;
      await shop.updateVariant(archived.id, await versionOf(archived.id), {
        isArchived: true,
      });
      await deliverNotifications(okSend);
      assert(
        (await noticeOf(archived.id)).status === "CANCELLED",
        "archived variant cancels its notice"
      );
      await shop.updateVariant(archived.id, await versionOf(archived.id), {
        isArchived: false,
      });
      assert(
        (await noticeOf(archived.id)).status === "PENDING",
        "unarchiving a variant with stock revives its notice"
      );
      await shop.setProductArchived(
        archived.productId,
        await productVersion(),
        true
      );
      await deliverNotifications(okSend);
      assert(
        (await noticeOf(archived.id)).status === "CANCELLED",
        "archived product cancels its notice"
      );
      await shop.setProductArchived(
        archived.productId,
        await productVersion(),
        false
      );
      assert(
        (await noticeOf(archived.id)).status === "PENDING",
        "unarchiving a product revives its notices"
      );
      await shop.setProductArchived(
        archived.productId,
        await productVersion(),
        true
      );
      await deliverNotifications(okSend);
      await shop.unsubscribe(
        (
          await db.restockSubscription.findFirstOrThrow({
            where: { variantId: archived.id },
          })
        ).unsubscribeToken
      );
      await shop.setProductArchived(
        archived.productId,
        await productVersion(),
        false
      );
      assert(
        (await noticeOf(archived.id)).status === "CANCELLED",
        "unsubscribed notices are never revived"
      );
      const security = await db.$queryRaw<
        {
          relname: string;
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }[]
      >`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('ProductCost','Order','RestockSubscription','OrderStatusHistory','FinancialSettings')`;
      assert(
        security.length === 5 &&
          security.every((r) => r.relrowsecurity && r.relforcerowsecurity),
        "RLS enabled and forced"
      );
      // Simulate Supabase browser roles: neither role can read business tables.
      for (const role of ["anon", "authenticated"]) {
        await db.$executeRawUnsafe(
          "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='" +
            role +
            "') THEN CREATE ROLE " +
            role +
            " NOLOGIN; END IF; END $$"
        );
        let denied = false;
        try {
          await db.$transaction(async (tx) => {
            await tx.$executeRawUnsafe("SET LOCAL ROLE " + role);
            await tx.productCost.findMany();
          });
        } catch {
          denied = true;
        }
        assert(denied, "browser role denied: " + role);
      }
      for (const role of ["anon", "authenticated"]) {
        let denied = false;
        try {
          await db.$transaction(async (tx) => {
            await tx.$executeRawUnsafe("SET LOCAL ROLE " + role);
            await tx.financialSettings.findMany();
          });
        } catch {
          denied = true;
        }
        assert(denied, "financial settings denied for " + role);
      }
      for (const role of ["anon", "authenticated", "lowkey_api"]) {
        for (const operation of ["SELECT", "UPDATE", "DELETE"]) {
          const allowed = role === "lowkey_api" && operation === "SELECT";
          let succeeded = false;
          try {
            await db.$transaction(async (tx) => {
              await tx.$executeRawUnsafe("SET LOCAL ROLE " + role);
              if (operation === "SELECT")
                await tx.orderStatusHistory.findMany({ take: 1 });
              if (operation === "UPDATE")
                await tx.orderStatusHistory.updateMany({
                  where: { orderId: saved.id },
                  data: { actorId: null },
                });
              if (operation === "DELETE")
                await tx.orderStatusHistory.deleteMany({
                  where: { orderId: saved.id },
                });
            });
            succeeded = true;
          } catch {
            /* permission denied is expected */
          }
          assert(succeeded === allowed, role + " history " + operation);
        }
      }
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE lowkey_api");
        await tx.orderStatusHistory.create({
          data: {
            orderId: saved.id,
            fromStatus: "PENDING_PAYMENT",
            toStatus: "CANCELLED",
            source: "MANUAL",
            actorId,
          },
        });
      });
      Deno.env.set("APP_DATABASE_URL", url!);
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "local-test-only");
      Deno.env.set("RATE_LIMIT_SECRET", "local-test-only");
      const { createApiHandler } =
        await import("../supabase/functions/api/handler.ts");
      const profiles = {
        ADMIN: await db.adminProfile.create({
          data: { id: crypto.randomUUID(), role: "ADMIN" },
        }),
        OPERATOR: await db.adminProfile.create({
          data: { id: crypto.randomUUID(), role: "OPERATOR" },
        }),
        INACTIVE: await db.adminProfile.create({
          data: { id: crypto.randomUUID(), role: "OPERATOR", active: false },
        }),
      };
      const fakeAuth = {
        auth: {
          getUser: (token: string) => {
            const profile = profiles[token as keyof typeof profiles];
            return Promise.resolve({
              data: {
                user: profile
                  ? { id: profile.id }
                  : token === "UNASSIGNED"
                    ? { id: "00000000-0000-4000-8000-000000000099" }
                    : null,
              },
              error:
                profile || token === "UNASSIGNED" ? null : new Error("invalid"),
            });
          },
        },
      } as unknown as NonNullable<Parameters<typeof createApiHandler>[1]>;
      const handler = createApiHandler(db, fakeAuth);
      // Users: exercise real HTTP authorization, persistence and delivery cooldown.
      const createdEmails = new Map<string, string>();
      const usersAdmin = await db.adminProfile.create({
        data: { id: crypto.randomUUID(), role: "ADMIN" },
      });
      let mailFails = false;
      let deliveries = 0;
      const usersHandler = createApiHandler(db, {
        auth: {
          getUser: (token: string) =>
            token === "ADMIN"
              ? Promise.resolve({
                  data: { user: { id: usersAdmin.id } },
                  error: null,
                })
              : fakeAuth.auth.getUser(token),
          admin: {
            createUser: ({ email }: { email: string }) => {
              if ([...createdEmails.values()].includes(email))
                return Promise.resolve({
                  data: {},
                  error: { code: "email_exists" },
                });
              const id = crypto.randomUUID();
              createdEmails.set(id, email);
              return Promise.resolve({ data: { user: { id } }, error: null });
            },
            getUserById: (id: string) =>
              Promise.resolve({
                data: {
                  user: {
                    id,
                    email: createdEmails.get(id) || `${id}@example.test`,
                  },
                },
                error: null,
              }),
            deleteUser: (id: string) => {
              createdEmails.delete(id);
              return Promise.resolve({ error: null });
            },
          },
          resetPasswordForEmail: () => {
            deliveries++;
            return Promise.resolve({
              error: mailFails ? new Error("mail unavailable") : null,
            });
          },
        },
      } as unknown as NonNullable<Parameters<typeof createApiHandler>[1]>);
      const usersRequest = (
        path: string,
        method: string,
        token?: string,
        body?: unknown
      ) =>
        usersHandler(
          new Request("http://localhost/v1/admin" + path, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: "Bearer " + token } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          })
        );
      for (const token of [undefined, "OPERATOR", "INACTIVE", "UNASSIGNED"]) {
        for (const [path, method] of [
          ["/users", "GET"],
          ["/users", "POST"],
          [`/users/${profiles.ADMIN.id}/password-link`, "POST"],
        ]) {
          const response = await usersRequest(path, method, token);
          assert(
            response.status === (token ? 403 : 401),
            "users API denies non-admin actors"
          );
        }
      }
      for (const role of ["ADMIN", "OPERATOR"]) {
        mailFails = role === "OPERATOR";
        const input = { email: `${role.toLowerCase()}-new@example.test`, role };
        const response = await usersRequest("/users", "POST", "ADMIN", input);
        const result = await response.json();
        assert(
          response.status === 201 && !result.password,
          "creates without exposing password"
        );
        assert(
          result.emailStatus === (mailFails ? "failed" : "accepted"),
          "reports partial email failure"
        );
        assert(
          (
            await db.adminProfile.findUniqueOrThrow({
              where: { id: result.id },
            })
          ).role === role,
          "persists chosen role"
        );
        assert(
          (await usersRequest("/users", "POST", "ADMIN", input)).status === 409,
          "duplicate is conflict"
        );
        assert(
          (
            await usersRequest(
              `/users/${result.id}/password-link`,
              "POST",
              "ADMIN"
            )
          ).status === 429,
          "initial email consumes cooldown"
        );
        await db.rateLimit.update({
          where: { key: "admin-password-link:" + result.id },
          data: { expiresAt: new Date(0) },
        });
        mailFails = false;
        const before = deliveries;
        const concurrent = await Promise.all([
          usersRequest(`/users/${result.id}/password-link`, "POST", "ADMIN"),
          usersRequest(`/users/${result.id}/password-link`, "POST", "ADMIN"),
        ]);
        assert(
          concurrent
            .map((r) => r.status)
            .sort()
            .join() === "200,429" && deliveries === before + 1,
          "atomic cooldown allows one resend"
        );
      }
      const usersList = await usersRequest("/users?page=1", "GET", "ADMIN");
      assert(
        usersList.status === 200 && (await usersList.json()).users.length <= 25,
        "lists bounded administrative profiles"
      );
      assert(
        (await usersRequest("/users?page=0", "GET", "ADMIN")).status === 400,
        "rejects invalid pagination"
      );
      const adminRequest = (
        path: string,
        method: string,
        token?: string,
        payload?: unknown
      ) =>
        handler(
          new Request("http://localhost/v1/admin" + path, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: "Bearer " + token } : {}),
            },
            ...(method === "GET"
              ? {}
              : { body: JSON.stringify(payload ?? {}) }),
          })
        );
      // Exercise authorization through the actual handler, before payload parsing or writes.
      const restricted = [
        ["/products", "POST"],
        ["/products/" + v.productId, "PUT"],
        ["/products/" + v.productId, "PATCH"],
        ["/variants", "POST"],
        ["/variants/" + v.id, "PATCH"],
        ["/restock", "GET"],
        ["/restock/retry", "POST"],
        ["/restock/retry-failed", "POST"],
        ["/finances", "GET"],
        ["/finances/dashboard", "GET"],
        ["/finances/settings", "GET"],
        ["/finances/settings", "PUT"],
        ["/finances/products/" + v.productId, "PATCH"],
        ["/finances", "PUT"],
        ["/roles", "GET"],
        ["/roles", "PUT"],
        ["/images", "POST"],
        ["/images/" + crypto.randomUUID(), "DELETE"],
        ["/health", "GET"],
      ];
      for (const [path, method] of restricted) {
        for (const token of [
          undefined,
          "INVALID",
          "OPERATOR",
          "INACTIVE",
          "UNASSIGNED",
        ]) {
          const response = await adminRequest(path, method, token);
          assert(
            response.status ===
              (token === "OPERATOR" ||
              token === "INACTIVE" ||
              token === "UNASSIGNED"
                ? 403
                : 401),
            method + " " + path + " rejects " + token
          );
        }
      }
      for (const path of ["/me", "/products", "/products/" + v.productId]) {
        for (const token of ["ADMIN", "OPERATOR"]) {
          const response = await adminRequest(path, "GET", token);
          assert(response.status === 200, "allowed read " + path);
          const serialized = await response.text();
          assert(
            !serialized.includes('"costPrice"') &&
              !serialized.includes('"financial"'),
            "operational DTO excludes costs"
          );
        }
      }
      const inventory = await variant(7);
      assert(
        (
          await adminRequest("/stock", "PATCH", "OPERATOR", {
            changes: [
              { id: inventory.id, version: inventory.version, stock: 9 },
            ],
          })
        ).status === 200,
        "operator updates stock"
      );
      assert(
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: inventory.id },
          })
        ).stock === 9,
        "stock persisted"
      );
      assert(
        (
          await adminRequest("/finances", "PUT", "ADMIN", {
            productId: inventory.productId,
            costPrice: "30.00",
          })
        ).status === 200,
        "admin updates cost"
      );
      // ADM-05: atomic prices, stale versions, filtered aggregates and global settings.
      const financialPath = "/finances/products/" + inventory.productId;
      const priceInput = { version: 1, salePrice: "100", costPrice: "80" };
      assert(
        (await adminRequest(financialPath, "PATCH", "ADMIN", priceInput))
          .status === 200,
        "financial prices saved"
      );
      assert(
        (
          await adminRequest(financialPath, "PATCH", "ADMIN", {
            ...priceInput,
            salePrice: "500",
            costPrice: "1",
          })
        ).status === 409,
        "stale prices rejected"
      );
      const savedProduct = await db.product.findUniqueOrThrow({
        where: { id: inventory.productId },
        include: { financial: true },
      });
      assert(
        savedProduct.salePrice.toString() === "100" &&
          savedProduct.financial?.costPrice.toString() === "80",
        "conflict leaves both prices unchanged"
      );
      const settings = await (
        await adminRequest("/finances/settings", "GET", "ADMIN")
      ).json();
      assert(
        (
          await adminRequest("/finances/settings", "PUT", "ADMIN", {
            version: settings.version,
            lowMarginThreshold: "20",
          })
        ).status === 200,
        "threshold persisted"
      );
      assert(
        (
          await adminRequest("/finances/settings", "PUT", "ADMIN", {
            version: settings.version,
            lowMarginThreshold: "40",
          })
        ).status === 409,
        "stale settings rejected"
      );
      await db.product.update({
        where: { id: inventory.productId },
        data: { name: "ADM05 unique" },
      });
      const report = await (
        await adminRequest("/finances/dashboard?q=ADM05", "GET", "ADMIN")
      ).json();
      assert(
        report.total === 1 &&
          report.kpis.averageMargin === "20.00" &&
          report.kpis.low === 0,
        "filtered average uses configured threshold"
      );
      const secondPage = await (
        await adminRequest("/finances/dashboard?q=ADM05&page=2", "GET", "ADMIN")
      ).json();
      assert(
        secondPage.items.length === 0 &&
          secondPage.kpis.averageMargin === "20.00",
        "aggregates independent of pagination"
      );
      const emptyReport = await (
        await adminRequest(
          "/finances/dashboard?q=not-existing-adm05",
          "GET",
          "ADMIN"
        )
      ).json();
      assert(emptyReport.kpis.averageMargin === null, "empty average is null");
      const financeCategory = await db.category.create({
        data: { name: "ADM05 test", slug: crypto.randomUUID() },
      });
      for (const [salePrice, costPrice, isArchived] of [
        ["100", "80", false],
        ["100", "120", false],
        ["0", "5", false],
        ["100", null, false],
        ["100", "0", true],
      ] as const) {
        await db.product.create({
          data: {
            name: "ADM05 group",
            slug: crypto.randomUUID(),
            salePrice,
            isArchived,
            categories: { create: { categoryId: financeCategory.id } },
            ...(costPrice === null
              ? {}
              : { financial: { create: { costPrice } } }),
          },
        });
      }
      const categoryReport = await (
        await adminRequest(
          "/finances/dashboard?category=" + financeCategory.id,
          "GET",
          "ADMIN"
        )
      ).json();
      assert(
        categoryReport.total === 4 &&
          categoryReport.kpis.eligible === 2 &&
          categoryReport.kpis.averageMargin === "0.00" &&
          categoryReport.kpis.negative === 2 &&
          categoryReport.kpis.missing === 1,
        "averages exclude missing and zero prices, counts include zero-price losses"
      );
      const archivedReport = await (
        await adminRequest(
          "/finances/dashboard?state=archived&category=" + financeCategory.id,
          "GET",
          "ADMIN"
        )
      ).json();
      assert(
        archivedReport.total === 1 &&
          archivedReport.kpis.averageMargin === "100.00",
        "archived filter and explicit zero cost"
      );
      for (const path of [
        "/v1/products",
        "/v1/products/" + savedProduct.slug,
      ]) {
        const publicResponse = await handler(
          new Request("http://localhost" + path)
        );
        assert(publicResponse.status === 200, "public catalog read succeeds");
        const serialized = await publicResponse.text();
        assert(
          !serialized.includes('"costPrice"') &&
            !serialized.includes('"financial"') &&
            !serialized.includes('"lowMarginThreshold"'),
          "public catalog excludes financial fields"
        );
      }
      const restockRequest = (variantId: string) =>
        handler(
          new Request("http://localhost/v1/restock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "http@example.com", variantId }),
          })
        );
      const httpEmpty = await variant(0);
      const createdResponse = await restockRequest(httpEmpty.id);
      assert(
        createdResponse.status === 201 &&
          (await createdResponse.json()).result === "created",
        "restock HTTP creates with 201"
      );
      const repeatedResponse = await restockRequest(httpEmpty.id);
      assert(
        repeatedResponse.status === 200 &&
          (await repeatedResponse.json()).result === "active",
        "restock HTTP repeat answers 200 active"
      );
      assert(
        (await restockRequest(crypto.randomUUID())).status === 404,
        "restock HTTP unknown variant 404"
      );
      assert(
        (await restockRequest((await variant(3)).id)).status === 409,
        "restock HTTP in-stock 409"
      );
      // LOG-06: backoffice list with filters, totals, counts and retries.
      const restockList = await adminRequest(
        "/restock?delivery=FAILED&q=BAD@EXAMPLE",
        "GET",
        "ADMIN"
      );
      const restockBody = await restockList.json();
      const failedNotice = restockBody.items?.[0]?.notifications?.[0];
      assert(
        restockList.status === 200 &&
          restockBody.total === 1 &&
          restockBody.pages === 1 &&
          restockBody.items[0].email === "bad@example.com" &&
          !("unsubscribeToken" in restockBody.items[0]) &&
          typeof restockBody.items[0].variant.stock === "number" &&
          failedNotice?.id === bad.id &&
          failedNotice.retry === "ready" &&
          restockBody.counts.FAILED >= 1,
        "restock list filters by delivery and email with totals"
      );
      assert(
        (await adminRequest("/restock?status=NOPE", "GET", "ADMIN")).status ===
          400,
        "restock list rejects unknown filters"
      );
      assert(
        (
          await adminRequest("/restock/retry", "POST", "ADMIN", {
            notificationId: bad.id,
          })
        ).status === 200,
        "restock HTTP retry requeues"
      );
      assert(
        (
          await adminRequest("/restock/retry", "POST", "ADMIN", {
            notificationId: bad.id,
          })
        ).status === 409,
        "restock HTTP retry rejects non-failed notices"
      );
      const bulkRetry = await adminRequest(
        "/restock/retry-failed",
        "POST",
        "ADMIN"
      );
      assert(
        bulkRetry.status === 200 &&
          typeof (await bulkRetry.json()).count === "number",
        "restock HTTP bulk retry"
      );
      // RFC 8058 one-click unsubscribe straight from the mail client.
      const oneClickVariant = await variant(0);
      await shop.subscribe("oneclick@example.com", oneClickVariant.id, false);
      const oneClickSub = await db.restockSubscription.findFirstOrThrow({
        where: { variantId: oneClickVariant.id },
      });
      const oneClick = (method: string, token: string) =>
        handler(
          new Request(
            "http://localhost/functions/v1/api/v1/unsubscribe/one-click?token=" +
              token,
            method === "POST"
              ? {
                  method,
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: "List-Unsubscribe=One-Click",
                }
              : { method }
          )
        );
      const oneClickGet = await oneClick("GET", oneClickSub.unsubscribeToken);
      assert(
        oneClickGet.status === 303 &&
          !!oneClickGet.headers
            .get("Location")
            ?.endsWith("/baja?token=" + oneClickSub.unsubscribeToken) &&
          (
            await db.restockSubscription.findUniqueOrThrow({
              where: { id: oneClickSub.id },
            })
          ).status === "ACTIVE",
        "one-click GET only redirects to the confirmation page"
      );
      assert(
        (await oneClick("POST", oneClickSub.unsubscribeToken)).status === 200 &&
          (
            await db.restockSubscription.findUniqueOrThrow({
              where: { id: oneClickSub.id },
            })
          ).status === "UNSUBSCRIBED",
        "one-click POST unsubscribes"
      );
      assert(
        (await oneClick("POST", "not-a-token")).status === 400,
        "one-click rejects malformed tokens"
      );
      const historical = await shop.createOrder(order(inventory.id));
      const originalSku = inventory.sku;
      assert(
        (
          await adminRequest("/variants/" + inventory.id, "PATCH", "ADMIN", {
            version: 2,
            size: "XL",
            color: "Azul",
            sku: crypto.randomUUID(),
            colorHex: "#0000ff",
          })
        ).status === 200,
        "variant attributes updated with version"
      );
      assert(
        (
          await adminRequest(
            "/products/" + inventory.productId,
            "PATCH",
            "ADMIN",
            {
              version: savedProduct.version,
              isArchived: true,
            }
          )
        ).status === 200,
        "product archived"
      );
      const historicalItem = await db.orderItem.findFirstOrThrow({
        where: { orderId: historical.id },
      });
      assert(
        historicalItem.sku === originalSku && historicalItem.size === "M",
        "variant editing preserves order snapshot"
      );
      assert(
        (
          await adminRequest("/stock", "PATCH", "OPERATOR", {
            changes: [{ id: inventory.id, version: 3, stock: 20 }],
          })
        ).status === 409,
        "archived stock blocked through API"
      );
      const archivedListing = await adminRequest(
        "/products?state=archived",
        "GET",
        "ADMIN"
      );
      assert(
        (await archivedListing.json()).items.some(
          (p: { id: string }) => p.id === inventory.productId
        ),
        "archived filter returns archived product"
      );
      assert(
        (
          await adminRequest(
            "/products/" + inventory.productId,
            "PATCH",
            "ADMIN",
            {
              version: savedProduct.version + 1,
              isArchived: false,
            }
          )
        ).status === 200,
        "product restored"
      );
      assert(
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: inventory.id },
          })
        ).stock === 8,
        "archive and restore preserve stock"
      );
      for (const path of ["/finances", "/roles", "/restock"]) {
        assert(
          (await adminRequest(path, "GET", "ADMIN")).status === 200,
          "admin read " + path
        );
      }
      assert(
        (await adminRequest("/unregistered", "GET", "ADMIN")).status === 403,
        "unknown endpoint denied"
      );
      await db.adminProfile.update({
        where: { id: profiles.ADMIN.id },
        data: { role: "OPERATOR" },
      });
      assert(
        (await adminRequest("/finances", "GET", "ADMIN")).status === 403,
        "downgrade applies to existing token"
      );
      await db.adminProfile.update({
        where: { id: profiles.ADMIN.id },
        data: { role: "ADMIN" },
      });
      await db.adminProfile.update({
        where: { id: profiles.OPERATOR.id },
        data: { active: false },
      });
      assert(
        (await adminRequest("/me", "GET", "OPERATOR")).status === 403,
        "deactivation applies to existing token"
      );
      await db.adminProfile.update({
        where: { id: profiles.OPERATOR.id },
        data: { active: true },
      });
      const send = (path: string, token?: string, status?: unknown) =>
        handler(
          new Request("http://localhost/v1/admin/orders" + path, {
            method: status === undefined ? "GET" : "PATCH",
            headers: {
              ...(token ? { Authorization: "Bearer " + token } : {}),
              "Content-Type": "application/json",
            },
            ...(status === undefined ? {} : { body: JSON.stringify(status) }),
          })
        );
      for (const token of [undefined, "INVALID", "INACTIVE"]) {
        const expected = token === "INACTIVE" ? 403 : 401;
        assert((await send("", token)).status === expected, "list auth");
        assert(
          (await send("/" + saved.id + "/history", token)).status === expected,
          "history auth"
        );
        assert(
          (await send("/" + saved.id, token, { status: "CANCELLED" }))
            .status === expected,
          "mutation auth"
        );
      }
      for (const token of ["ADMIN", "OPERATOR"] as const) {
        const apiOrder = await shop.createOrder(order((await variant()).id));
        assert((await send("", token)).status === 200, "role lists orders");
        assert(
          (await send("/" + apiOrder.id, token, { status: "SHIPPED" }))
            .status === 409,
          "illegal API transition"
        );
        assert(
          (
            await send("/" + apiOrder.id, token, {
              status: "CONFIRMED",
              actorId: crypto.randomUUID(),
            })
          ).status === 400,
          "actor spoof rejected"
        );
        const response = await send("/" + apiOrder.id, token, {
          status: "CONFIRMED",
        });
        const result = await response.json();
        assert(
          response.status === 200 &&
            result.availableActions.join() === "SHIPPED",
          "API actions reflect new state"
        );
        const historyResponse = await send(
          "/" + apiOrder.id + "/history",
          token
        );
        const history = await historyResponse.json();
        assert(
          historyResponse.status === 200 &&
            history.some(
              (e: { actorId: string }) => e.actorId === profiles[token].id
            ),
          "API actor from session"
        );
      }
      const filteredResponse = await send("?status=SHIPPED", "OPERATOR");
      assert(
        filteredResponse.status === 200 &&
          (await filteredResponse.json()).every(
            (o: { status: string }) => o.status === "SHIPPED"
          ),
        "status filter"
      );
      assert(
        (await send("?status=UNKNOWN", "ADMIN")).status === 400,
        "filter validation"
      );
      assert(
        (await send("/" + crypto.randomUUID() + "/history", "ADMIN")).status ===
          404,
        "missing history order"
      );
      assert(
        (
          await send("/" + crypto.randomUUID(), "ADMIN", {
            status: "CANCELLED",
          })
        ).status === 404,
        "missing order mutation"
      );
      await mediaIntegration(db);
      console.log("Integration assertions passed");
    } finally {
      await db.$disconnect();
    }
  },
});
