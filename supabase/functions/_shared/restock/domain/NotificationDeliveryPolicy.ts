/**
 * Pure delivery rules for restock notifications (LOG-06).
 *
 * `attempts` counts real POSTs to the provider only; waiting for stock never
 * counts. `firstAttemptAt` starts Resend's idempotency window: inside it a
 * repeated send with the same Idempotency-Key is deduplicated, outside it a
 * resend could reach the customer twice.
 */
export const MAX_ATTEMPTS = 5;
export const IDEMPOTENCY_WINDOW_MS = 23 * 3600000;
export const STOCK_WAIT_MS = 15 * 60000;

export type DeliveryState = {
  attempts: number;
  firstAttemptAt: Date | null;
};
export type RetryEligibility = "ready" | "needs-confirmation" | null;

/** Minutes grow 2, 4, 8… capped at one hour. */
export function backoffMs(attempts: number): number {
  return Math.min(60, 2 ** attempts) * 60000;
}

/** A started delivery whose dedup window closed: its outcome can't be verified by resending. */
export function isDeliveryUncertain(n: DeliveryState, now: Date): boolean {
  return (
    n.attempts > 0 &&
    n.firstAttemptAt !== null &&
    n.firstAttemptAt.getTime() < now.getTime() - IDEMPOTENCY_WINDOW_MS
  );
}

/** Provider rejections that will fail the same way on every retry. */
export function classifyProviderError(
  status: number | null
): "permanent" | "transient" {
  return status !== null && [400, 401, 403, 422].includes(status)
    ? "permanent"
    : "transient";
}

export function retryEligibility(
  n: DeliveryState & { status: string },
  subscriptionStatus: string,
  now: Date
): RetryEligibility {
  if (n.status !== "FAILED" || subscriptionStatus !== "ACTIVE") return null;
  return isDeliveryUncertain(n, now) ? "needs-confirmation" : "ready";
}

export function providerErrorMessage(status: number | null): string {
  if (status === null) return "Sin respuesta del proveedor";
  return classifyProviderError(status) === "permanent"
    ? "Resend rechazó el correo (HTTP " + status + ")"
    : "Proveedor respondió HTTP " + status;
}
