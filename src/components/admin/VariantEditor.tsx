"use client";
import { useState } from "react";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";
import { saveVariant } from "@/modules/inventory/application/actions";

export default function VariantEditor({
  product,
  onSaved,
}: {
  product: CatalogProduct;
  onSaved: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<
    CatalogProduct["variants"][number] | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  async function archive(variant: CatalogProduct["variants"][number]) {
    setBusy(true);
    setError("");
    try {
      const result = await saveVariant(variant.id, {
        version: variant.version,
        isArchived: !variant.isArchived,
      });
      if (!result.ok) {
        setError(result.message);
        setConflict(result.status === 409);
        return;
      }
      setSelected(null);
      await onSaved();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 border p-4">
      <h3 className="text-xl">Variantes de {product.name}</h3>
      <p role="alert">{error}</p>
      {conflict && (
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Recargar descartará la edición pendiente. ¿Continuar?"
              )
            )
              void onSaved();
          }}
        >
          Recargar variantes
        </button>
      )}
      <ul className="space-y-2">
        {product.variants.map((v) => (
          <li key={v.id} className="flex flex-wrap gap-3">
            <span>
              {v.size} / {v.color} · {v.sku} ·{" "}
              {v.isArchived ? "Archivada" : "Activa"}
            </span>
            <button
              disabled={busy}
              onClick={() => {
                setSelected(v);
                setError("");
              }}
              className="underline"
            >
              Editar {v.sku}
            </button>
            <button
              disabled={busy}
              onClick={() => void archive(v)}
              className="underline"
            >
              {v.isArchived ? "Restaurar" : "Archivar"} {v.sku}
            </button>
          </li>
        ))}
      </ul>
      <form
        key={selected?.id + ":" + selected?.version}
        className="grid gap-3 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          setBusy(true);
          setError("");
          try {
            const fields = {
              size: String(f.get("size")),
              color: String(f.get("color")),
              colorHex: String(f.get("colorHex")),
              sku: String(f.get("sku")),
            };
            const result = await saveVariant(
              selected?.id ?? null,
              selected
                ? { ...fields, version: selected.version }
                : { ...fields, productId: product.id }
            );
            if (!result.ok) {
              setError(result.message);
              setConflict(result.status === 409);
              return;
            }
            form.reset();
            setSelected(null);
            await onSaved();
          } catch {
            setError("No se pudo guardar. Intenta de nuevo.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="contents">
          <legend>
            {selected ? "Editar variante" : "Nueva variante (stock inicial: 0)"}
          </legend>
          <label>
            Talla
            <input
              name="size"
              required
              maxLength={30}
              defaultValue={selected?.size}
            />
          </label>
          <label>
            Color
            <input
              name="color"
              required
              maxLength={60}
              defaultValue={selected?.color}
            />
          </label>
          <label>
            Color visual
            <input
              name="colorHex"
              type="color"
              defaultValue={selected?.colorHex ?? "#222222"}
            />
          </label>
          <label>
            SKU
            <input
              name="sku"
              required
              maxLength={80}
              defaultValue={selected?.sku}
            />
          </label>
          <button className="shop-button">
            {selected ? "Guardar variante" : "Agregar variante"}
          </button>
          {selected && (
            <button type="button" onClick={() => setSelected(null)}>
              Cancelar edición
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
