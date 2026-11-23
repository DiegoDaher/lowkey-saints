export const LOW_STOCK_THRESHOLD = 2;

export type StockStatus = "in_stock" | "low" | "out" | "limit";
export type StockReason = "ok" | "out_of_stock" | "limit_in_cart";

export type StockCheck = {
  status: StockStatus;
  reason: StockReason;
  available: number;
  canPurchase: boolean;
  label: string | null;
};

type StockVariant = { stock: number; isArchived?: boolean };

const out = (available: number): StockCheck => ({
  status: "out",
  reason: "out_of_stock",
  available,
  canPurchase: false,
  label: "Agotado",
});

/**
 * Pure stock validation for a variant.
 * `requestedQty` is what the customer wants to add; `inCart` is what they already hold.
 */
export function checkStock(
  variant: StockVariant | undefined | null,
  requestedQty = 1,
  inCart = 0
): StockCheck {
  const raw = variant && !variant.isArchived ? Math.floor(variant.stock) : 0;
  const available = Number.isFinite(raw) && raw > 0 ? raw : 0;
  if (available === 0) return out(available);
  if (inCart + requestedQty > available) {
    if (inCart === 0) return out(available);
    return {
      status: "limit",
      reason: "limit_in_cart",
      available,
      canPurchase: false,
      label: "Ya tienes todas las piezas disponibles en tu bolsa",
    };
  }
  if (available <= LOW_STOCK_THRESHOLD) {
    return {
      status: "low",
      reason: "ok",
      available,
      canPurchase: true,
      label: available === 1 ? "Última pieza" : `Últimas ${available} piezas`,
    };
  }
  return {
    status: "in_stock",
    reason: "ok",
    available,
    canPurchase: true,
    label: null,
  };
}
