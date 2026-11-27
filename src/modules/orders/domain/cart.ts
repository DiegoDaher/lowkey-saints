/**
 * Pure cart domain. Money is always handled as integer cents; decimals only
 * appear when parsing API strings and when formatting for display.
 */
export const MAX_PER_LINE = 20;
export const HOLD_MS = 60 * 60_000;

export interface CartLine {
  variantId: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  image?: string;
  priceCents: number;
  /** Stock known when the line was added; the server confirms on checkout. */
  maxQuantity: number;
  quantity: number;
}

export interface CartState {
  items: CartLine[];
  /** Epoch ms of the last addition; drives the tentative hold notice. */
  heldAt: number | null;
}

export const emptyCart: CartState = { items: [], heldAt: null };

/** "100.25" → 10025, "19" → 1900, "1999.9" → 199990. Never multiplies floats. */
export function toCents(value: string | number): number {
  const match = /^\s*(-?)(\d+)(?:\.(\d{0,2})\d*)?\s*$/.exec(String(value));
  if (!match) return 0;
  const [, sign, whole, fraction = ""] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return sign ? -cents : cents;
}

export function lineLimit(line: Pick<CartLine, "maxQuantity">): number {
  return Math.max(0, Math.min(MAX_PER_LINE, Math.floor(line.maxQuantity)));
}

export const lineTotal = (line: CartLine) => line.priceCents * line.quantity;

export const subtotalCents = (items: CartLine[]) =>
  items.reduce((sum, line) => sum + lineTotal(line), 0);

export const itemCount = (items: CartLine[]) =>
  items.reduce((sum, line) => sum + line.quantity, 0);

export function addLine(
  state: CartState,
  line: Omit<CartLine, "quantity">,
  now: number,
  quantity = 1
): CartState {
  const existing = state.items.find((i) => i.variantId === line.variantId);
  const merged = { ...existing, ...line };
  const next = Math.min(
    lineLimit(merged),
    (existing?.quantity ?? 0) + quantity
  );
  if (next <= 0) return state;
  const items = existing
    ? state.items.map((i) =>
        i.variantId === line.variantId ? { ...merged, quantity: next } : i
      )
    : [...state.items, { ...line, quantity: next }];
  return { items, heldAt: now };
}

export function setQuantity(
  state: CartState,
  variantId: string,
  quantity: number
): CartState {
  const items = state.items
    .map((i) =>
      i.variantId === variantId
        ? { ...i, quantity: Math.min(lineLimit(i), Math.floor(quantity)) }
        : i
    )
    .filter((i) => i.quantity > 0);
  return { items, heldAt: items.length ? state.heldAt : null };
}

export const removeLine = (state: CartState, variantId: string) =>
  setQuantity(state, variantId, 0);

export function holdRemaining(heldAt: number | null, now: number): number {
  return heldAt === null ? 0 : Math.max(0, heldAt + HOLD_MS - now);
}

export const isHoldExpired = (heldAt: number | null, now: number) =>
  heldAt !== null && holdRemaining(heldAt, now) === 0;

function isLine(x: unknown): x is CartLine {
  const l = x as CartLine;
  return (
    !!l &&
    typeof l.variantId === "string" &&
    typeof l.name === "string" &&
    typeof l.slug === "string" &&
    typeof l.size === "string" &&
    typeof l.color === "string" &&
    (l.image === undefined || typeof l.image === "string") &&
    Number.isInteger(l.priceCents) &&
    l.priceCents >= 0 &&
    Number.isInteger(l.maxQuantity) &&
    Number.isInteger(l.quantity) &&
    l.quantity > 0 &&
    l.quantity <= lineLimit(l)
  );
}

export function parseCartState(raw: string | null): CartState {
  if (!raw) return emptyCart;
  try {
    const value = JSON.parse(raw);
    const items = Array.isArray(value?.items) ? value.items.filter(isLine) : [];
    const heldAt = Number.isFinite(value?.heldAt) ? value.heldAt : null;
    return items.length ? { items, heldAt: heldAt ?? null } : emptyCart;
  } catch {
    return emptyCart;
  }
}

/** Converts the pre-PDP-04 `lowkey-cart` array (decimal `price` strings). */
export function migrateLegacy(raw: string | null, now: number): CartState {
  if (!raw) return emptyCart;
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return emptyCart;
    const items = value
      .filter(
        (x) =>
          typeof x?.variantId === "string" &&
          typeof x.name === "string" &&
          typeof x.price === "string" &&
          Number.isInteger(x.quantity) &&
          x.quantity > 0 &&
          x.quantity <= MAX_PER_LINE
      )
      .map((x): CartLine => ({
        variantId: x.variantId,
        slug: typeof x.slug === "string" ? x.slug : "",
        name: x.name,
        size: String(x.size ?? ""),
        color: String(x.color ?? ""),
        priceCents: toCents(x.price),
        maxQuantity: MAX_PER_LINE,
        quantity: x.quantity,
      }));
    return items.length ? { items, heldAt: now } : emptyCart;
  } catch {
    return emptyCart;
  }
}
