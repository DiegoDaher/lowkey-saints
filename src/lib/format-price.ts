const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function formatPrice(price: number): string {
  return mxnFormatter.format(price);
}
