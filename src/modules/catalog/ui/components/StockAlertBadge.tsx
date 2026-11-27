import type { StockCheck } from "@/modules/inventory/application/CheckStockUseCase";

const tone = {
  in_stock: { text: "text-muted", dot: "bg-gold" },
  low: { text: "text-gold-dark", dot: "bg-gold-dark" },
  limit: { text: "text-gold-dark", dot: "bg-gold-dark" },
  out: { text: "text-sale", dot: "bg-sale" },
} as const;

export default function StockAlertBadge({ stock }: { stock: StockCheck }) {
  const t = tone[stock.status];
  return (
    <p
      className={`flex items-center gap-2 text-sm font-semibold tracking-wide ${t.text}`}
      role="status"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${t.dot}`} />
      <span className={stock.label ? "uppercase" : "font-normal"}>
        {stock.label ?? "Disponible"}
      </span>
    </p>
  );
}
