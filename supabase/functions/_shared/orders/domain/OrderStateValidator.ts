import { AppError } from "../../AppError.ts";

export const orderStatuses = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "SHIPPED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export type OrderAction = Exclude<OrderStatus, "PENDING_PAYMENT">;

const transitions: Record<OrderStatus, readonly OrderAction[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED"],
  SHIPPED: [],
  CANCELLED: [],
};

export function availableOrderActions(
  status: OrderStatus,
  expiresAt: Date,
  now: Date
): OrderAction[] {
  return transitions[status].filter(
    (action) => action !== "CONFIRMED" || expiresAt > now
  );
}

export function requireTransition(
  from: string,
  to: string,
  expiresAt: Date,
  now: Date
): void {
  if (
    !orderStatuses.includes(from as OrderStatus) ||
    !transitions[from as OrderStatus].includes(to as OrderAction)
  ) {
    throw new AppError(409, "Transición de pedido no permitida");
  }
  if (to === "CONFIRMED" && expiresAt <= now)
    throw new AppError(409, "El pedido venció");
}
