import type { PrismaClient } from "../../generated/prisma/client.ts";
import { renderRestockEmail } from "../infra/RestockEmail.ts";
import { ProviderError, type Mailer } from "../infra/ResendMailer.ts";
import {
  MAX_ATTEMPTS,
  STOCK_WAIT_MS,
  backoffMs,
  classifyProviderError,
  isDeliveryUncertain,
  providerErrorMessage,
} from "../domain/NotificationDeliveryPolicy.ts";

export type DeliveryConfig = {
  /** Public storefront origin, e.g. https://tienda.mx */
  siteUrl: string;
  /** Public base of the api Edge Function, e.g. https://x.supabase.co/functions/v1/api */
  apiUrl?: string;
};

/** Headers for RFC 2369 + RFC 8058 (one-click needs an HTTPS POST endpoint). */
export function unsubscribeHeaders(
  config: DeliveryConfig,
  token: string
): Record<string, string> {
  const page = config.siteUrl + "/baja?token=" + token;
  if (!config.apiUrl?.startsWith("https://"))
    return { "List-Unsubscribe": "<" + page + ">" };
  const oneClick =
    config.apiUrl.replace(/\/$/, "") +
    "/v1/unsubscribe/one-click?token=" +
    token;
  return {
    "List-Unsubscribe": "<" + oneClick + ">, <" + page + ">",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Drains the Notification outbox (LOG-06). Called every minute by the jobs
 * function. Only real POSTs to the provider count as attempts: waiting for
 * stock to come back never turns a notice into FAILED.
 */
export class DeliverRestockNotificationsUseCase {
  constructor(
    private readonly db: PrismaClient,
    private readonly mailer: Mailer,
    private readonly config: DeliveryConfig
  ) {}

  async execute(batch = 25): Promise<number> {
    const now = new Date();
    // A crashed worker leaves PROCESSING rows behind; attempts already reflect
    // whether a POST was started, so the uncertainty guard stays correct.
    await this.db.notification.updateMany({
      where: {
        status: "PROCESSING",
        lockedAt: { lt: new Date(now.getTime() - 5 * 60000) },
      },
      data: { status: "PENDING", lockedAt: null },
    });
    const rows = await this.db.notification.findMany({
      where: { status: "PENDING", availableAt: { lte: now } },
      take: batch,
      orderBy: { createdAt: "asc" },
    });
    let sent = 0;
    for (const row of rows) {
      const claim = await this.db.notification.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "PROCESSING", lockedAt: now },
      });
      if (!claim.count) continue;
      if (await this.deliver(row.id)) sent++;
    }
    return sent;
  }

  private async deliver(id: string): Promise<boolean> {
    const row = await this.db.notification.findUniqueOrThrow({
      where: { id },
      include: {
        subscription: { include: { variant: { include: { product: true } } } },
      },
    });
    const sub = row.subscription;
    const release = (data: Record<string, unknown>) =>
      this.db.notification.update({
        where: { id },
        data: { lockedAt: null, ...data },
      });
    if (
      sub.status !== "ACTIVE" ||
      sub.generation !== row.generation ||
      sub.variant.isArchived ||
      sub.variant.product.isArchived
    ) {
      await release({ status: "CANCELLED" });
      return false;
    }
    if (sub.variant.stock === 0) {
      // Stock sold out again before delivery: wait without spending an attempt.
      await release({
        status: "PENDING",
        availableAt: new Date(Date.now() + STOCK_WAIT_MS),
      });
      return false;
    }
    if (isDeliveryUncertain(row, new Date())) {
      await release({
        status: "FAILED",
        lastError: "Entrega incierta: revisar proveedor antes de reintentar",
      });
      return false;
    }
    const attempts = row.attempts + 1;
    await this.db.notification.update({
      where: { id },
      data: { attempts, firstAttemptAt: row.firstAttemptAt ?? new Date() },
    });
    const email = renderRestockEmail({
      productName: sub.variant.product.name,
      size: sub.variant.size,
      color: sub.variant.color,
      productUrl:
        this.config.siteUrl + "/productos/" + sub.variant.product.slug,
      unsubscribeUrl:
        this.config.siteUrl + "/baja?token=" + sub.unsubscribeToken,
    });
    try {
      await this.mailer.send({
        to: sub.email,
        ...email,
        headers: unsubscribeHeaders(this.config, sub.unsubscribeToken),
        idempotencyKey: row.id,
      });
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : null;
      const permanent =
        e instanceof ProviderError &&
        classifyProviderError(status) === "permanent";
      await release({
        status: permanent || attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        availableAt: new Date(Date.now() + backoffMs(attempts)),
        lastError:
          e instanceof ProviderError && status !== null
            ? providerErrorMessage(status)
            : e instanceof Error
              ? e.message.slice(0, 200)
              : "Error de entrega",
      });
      return false;
    }
    await this.db.$transaction(async (tx) => {
      await tx.notification.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
      await tx.restockSubscription.updateMany({
        where: { id: sub.id, status: "ACTIVE", generation: row.generation },
        data: { status: "NOTIFIED" },
      });
    });
    return true;
  }
}
