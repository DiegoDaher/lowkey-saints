import { PrismaClient } from "../supabase/functions/_shared/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { ShopService } from "../supabase/functions/_shared/service.ts";
import { deliverNotifications } from "../supabase/functions/_shared/notifications.ts";
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
      const v2 = await variant(3);
      const payload = order(v2.id);
      const repeated = await Promise.all([
        shop.createOrder(payload),
        shop.createOrder(payload),
      ]);
      assert(repeated[0].id === repeated[1].id, "idempotency");
      assert(
        (await db.productVariant.findUniqueOrThrow({ where: { id: v2.id } }))
          .stock === 2,
        "replay does not reserve"
      );
      let rejected = false;
      try {
        await shop.createOrder({ ...payload, clientName: "Changed" });
      } catch {
        rejected = true;
      }
      assert(rejected, "idempotency mismatch rejected");
      const empty = await variant(0);
      const rollback = await variant(2);
      try {
        await shop.createOrder({
          ...order(rollback.id),
          items: [
            { variantId: rollback.id, quantity: 1 },
            { variantId: empty.id, quantity: 1 },
          ],
        });
      } catch {}
      assert(
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: rollback.id },
          })
        ).stock === 2,
        "whole order rollback"
      );
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
      await shop.expire();
      assert(
        (await db.productVariant.findUniqueOrThrow({ where: { id: v2.id } }))
          .stock === 3,
        "expiry idempotent"
      );
      await shop.subscribe("test@example.com", empty.id, false);
      await shop.subscribe("test@example.com", empty.id, false);
      assert(
        (await db.restockSubscription.count({
          where: { variantId: empty.id },
        })) === 1,
        "subscription deduplicated"
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
      const mail = {
        apiKey: "test",
        from: "test@example.com",
        siteUrl: "https://example.com",
      };
      await deliverNotifications(
        db,
        mail,
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
      await deliverNotifications(db, mail, (async () => {
        calls++;
        return Response.json({ id: "test" });
      }) as typeof fetch);
      await deliverNotifications(db, mail, (async () => {
        calls++;
        return Response.json({ id: "test" });
      }) as typeof fetch);
      assert(calls === 1, "sent messages not resent");
      const sub = await db.restockSubscription.findFirstOrThrow();
      await shop.unsubscribe(sub.unsubscribeToken);
      assert(
        (
          await db.restockSubscription.findUniqueOrThrow({
            where: { id: sub.id },
          })
        ).status === "UNSUBSCRIBED",
        "unsubscribe persisted"
      );
      const security = await db.$queryRaw<
        {
          relname: string;
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }[]
      >`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('ProductCost','Order','RestockSubscription')`;
      assert(
        security.length === 3 &&
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
      console.log("Integration assertions passed");
    } finally {
      await db.$disconnect();
    }
  },
});
