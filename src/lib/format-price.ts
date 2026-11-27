const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function formatPrice(price: number): string {
  return mxnFormatter.format(price);
}

/** Formats integer cents; the division happens only for display. */
export function formatCents(cents: number): string {
  return mxnFormatter.format(cents / 100);
}
