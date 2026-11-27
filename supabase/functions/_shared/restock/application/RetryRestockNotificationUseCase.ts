import type { PrismaClient } from "../../generated/prisma/client.ts";
import { AppError } from "../../AppError.ts";
import {
  IDEMPOTENCY_WINDOW_MS,
  retryEligibility,
} from "../domain/NotificationDeliveryPolicy.ts";

/** Backoffice retries for FAILED restock notifications (LOG-06). */
export class RetryRestockNotificationUseCase {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Inside Resend's dedup window the retry is safe. Outside it the customer
   * could get the email twice, so the admin must confirm with `force`.
   */
  async retryOne(notificationId: string, force: boolean) {
    const n = await this.db.notification.findUnique({
      where: { id: notificationId },
      include: { subscription: { select: { status: true } } },
    });
    if (!n) throw new AppError(404, "Notificación no encontrada");
    const eligibility = retryEligibility(n, n.subscription.status, new Date());
    if (!eligibility)
      throw new AppError(
        409,
        "Este aviso ya no admite reintentos; actualiza la vista"
      );
    if (eligibility === "needs-confirmation" && !force)
      throw new AppError(
        409,
        "Podría llegar duplicado; confirma para reintentar"
      );
    const updated = await this.db.notification.updateMany({
      where: { id: n.id, status: "FAILED" },
      data: {
        status: "PENDING",
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
        // A forced retry starts a fresh dedup window.
        ...(eligibility === "needs-confirmation"
          ? { firstAttemptAt: null }
          : {}),
      },
    });
    if (!updated.count)
      throw new AppError(409, "El aviso cambió; actualiza la vista");
    return { ok: true, forced: eligibility === "needs-confirmation" };
  }

  /** Requeues every FAILED notice that is still safe to resend. */
  async retryAllReady() {
    const windowStart = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
    const { count } = await this.db.notification.updateMany({
      where: {
        status: "FAILED",
        subscription: { status: "ACTIVE" },
        OR: [
          { attempts: 0 },
          { firstAttemptAt: null },
          { firstAttemptAt: { gte: windowStart } },
        ],
      },
      data: {
        status: "PENDING",
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    return { count };
  }
}
