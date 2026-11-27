import type { RestockResult } from "../../contracts.ts";

export type SubscriptionStatus = "ACTIVE" | "NOTIFIED" | "UNSUBSCRIBED";
export type SubscriptionDecision = {
  action: "create" | "reactivate" | "none";
  result: RestockResult;
};

/**
 * One subscription per email and variant (LOG-05).
 * - New email: create it.
 * - Already waiting: nothing to do, the request is idempotent.
 * - Already notified: the shopper wants the next restock too, reactivate it.
 * - Unsubscribed: only reactivate when the shopper confirms it explicitly.
 */
export function decideSubscription(
  prior: { status: SubscriptionStatus } | null,
  reactivate: boolean
): SubscriptionDecision {
  if (!prior) return { action: "create", result: "created" };
  if (prior.status === "ACTIVE") return { action: "none", result: "active" };
  if (prior.status === "NOTIFIED" || reactivate)
    return { action: "reactivate", result: "reactivated" };
  return { action: "none", result: "unsubscribed" };
}
