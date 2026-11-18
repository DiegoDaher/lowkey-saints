"use client";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";
import type { StockDraft } from "@/modules/inventory/domain/stock-draft";

export default function InventoryMatrix({
  product,
  draft,
  disabled,
  onChange,
}: {
  product: CatalogProduct;
  draft: StockDraft;
  disabled: boolean;
  onChange: (
    variant: CatalogProduct["variants"][number],
    value: string
  ) => void;
}) {
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Set(product.variants.map((v) => v.color))];
  const cells = new Map(
    product.variants.map((v) => [JSON.stringify([v.size, v.color]), v])
  );
  return (
    <section className="space-y-3 border p-4">
      <h2 className="text-xl">
        {product.name} {product.isArchived && "(Archivado)"}
      </h2>
      {!sizes.length ? (
        <p>Sin variantes. Añádelas desde el catálogo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">Existencias de {product.name}</caption>
            <thead>
              <tr>
                <th scope="col">Talla / Color</th>
                {colors.map((color) => (
                  <th scope="col" key={color}>
                    {color}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizes.map((size) => (
                <tr key={size}>
                  <th scope="row">{size}</th>
                  {colors.map((color) => {
                    const variant = cells.get(JSON.stringify([size, color]));
                    if (!variant)
                      return (
                        <td key={color}>
                          <span aria-label="Combinación inexistente">—</span>
                        </td>
                      );
                    const changed = Boolean(draft[variant.id]);
                    return (
                      <td
                        key={color}
                        className={changed ? "bg-amber-50 p-3" : "p-3"}
                      >
                        <input
                          aria-label={`${product.name}: ${size} / ${color}`}
                          type="number"
                          min="0"
                          max="100000"
                          step="1"
                          value={
                            draft[variant.id]?.value ?? String(variant.stock)
                          }
                          disabled={
                            disabled ||
                            product.isArchived ||
                            variant.isArchived ||
                            (!changed && Object.keys(draft).length >= 100)
                          }
                          onChange={(e) => onChange(variant, e.target.value)}
                          className="min-w-24"
                        />
                        <small className="block">
                          {variant.sku}
                          {variant.isArchived
                            ? " · Archivada"
                            : changed
                              ? " · Modificada"
                              : ""}
                        </small>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
