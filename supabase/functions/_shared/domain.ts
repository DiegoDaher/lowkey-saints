export class AppError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export function requireTransition(
  from: string,
  to: string,
  expiresAt: Date,
  now: Date
) {
  const allowed: Record<string, string[]> = {
    PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED"],
  };
  if (!allowed[from]?.includes(to))
    throw new AppError(409, "Transición de pedido no permitida");
  if (to === "CONFIRMED" && expiresAt <= now)
    throw new AppError(409, "El pedido venció");
}
export function mergeItems(items: { variantId: string; quantity: number }[]) {
  const grouped = new Map<string, number>();
  for (const item of items)
    grouped.set(
      item.variantId,
      (grouped.get(item.variantId) || 0) + item.quantity
    );
  if ([...grouped.values()].some((q) => q > 20))
    throw new AppError(400, "Máximo 20 unidades por variante");
  return [...grouped]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}
export async function hash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function margin(sale: number, cost: number) {
  return {
    amount: sale - cost,
    percent: sale === 0 ? null : ((sale - cost) / sale) * 100,
  };
}
