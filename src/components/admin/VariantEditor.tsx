"use client";
import { useRef, useState } from "react";
import {
  variantInput,
  variantUpdateInput,
  type CatalogProduct,
} from "../../../supabase/functions/_shared/contracts";
import { saveVariant } from "@/modules/inventory/application/actions";
import AdminModal from "./AdminModal";
import AdminButton from "./AdminButton";
type Variant = CatalogProduct["variants"][number];
const empty = { size: "", color: "", colorHex: "#222222", sku: "" };
export default function VariantEditor({
  product,
  call,
  onClose,
}: {
  product: CatalogProduct;
  call: <T>(path: string, options?: RequestInit) => Promise<T>;
  onClose: (changed: boolean) => void;
}) {
  const [record, setRecord] = useState(product);
  const [selected, setSelected] = useState<Variant | null>(null);
  const [draft, setDraft] = useState(empty);
  const [baseline, setBaseline] = useState(JSON.stringify(empty));
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const locked = useRef(false);
  const changed = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(draft) !== baseline;
  function edit(v: Variant | null) {
    const value = v
      ? { size: v.size, color: v.color, colorHex: v.colorHex, sku: v.sku }
      : empty;
    setSelected(v);
    setDraft(value);
    setBaseline(JSON.stringify(value));
    setError("");
    setNotice("");
  }
  function guard(next: () => void) {
    if (dirty) setPending(() => next);
    else next();
  }
  async function refresh() {
    try {
      const fresh = await call<CatalogProduct>("/admin/products/" + product.id);
      setRecord(fresh);
      setRefreshFailed(false);
      setConflict(false);
      setError("");
      edit(null);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar el listado."
      );
      setRefreshFailed(true);
      return false;
    }
  }
  async function mutate(variantId: string | null, input: unknown, op: string) {
    if (locked.current || refreshFailed) return;
    locked.current = true;
    setBusy(true);
    setOperation(op);
    setError("");
    setNotice("");
    try {
      const result = await saveVariant(variantId, input);
      if (!result.ok) {
        setError(result.message);
        setConflict(result.status === 409);
        if ([401, 403].includes(result.status))
          window.location.replace(
            result.status === 401 ? "/401" : "/140210/sin-acceso"
          );
        return;
      }
      changed.current = true;
      edit(null);
      if (await refresh())
        setNotice("Variante guardada. Puedes continuar con otra.");
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      locked.current = false;
      setBusy(false);
      setOperation("");
    }
  }
  return (
    <AdminModal
      title={"Variantes de " + record.name}
      dirty={dirty}
      busy={busy}
      onClose={() => onClose(changed.current)}
      footer={
        <p>
          Las variantes nuevas comienzan con stock cero. Las existencias se
          administran en Inventario.
        </p>
      }
    >
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {(conflict || refreshFailed) && (
        <AdminButton
          type="button"
          disabled={busy}
          onClick={() =>
            guard(() => {
              setBusy(true);
              void refresh().finally(() => setBusy(false));
            })
          }
        >
          {refreshFailed ? "Reintentar actualización" : "Recargar variantes"}
        </AdminButton>
      )}
      {pending && (
        <div
          className="admin-inline-confirm"
          role="group"
          aria-label="Cambios sin guardar"
        >
          <p>Hay cambios sin guardar en el formulario de la variante.</p>
          <AdminButton type="button" onClick={() => setPending(null)}>
            Seguir editando
          </AdminButton>
          <AdminButton
            type="button"
            variant="danger"
            onClick={() => {
              const next = pending;
              setPending(null);
              next();
            }}
          >
            Descartar y continuar
          </AdminButton>
        </div>
      )}
      <div className="admin-variant-grid">
        <section aria-label="Variantes existentes">
          <h3>Variantes existentes</h3>
          {!record.variants.length && (
            <p>Esta prenda todavía no tiene variantes.</p>
          )}
          <ul className="space-y-3">
            {record.variants.map((v) => (
              <li key={v.id} className="admin-variant-card">
                <div>
                  <strong>
                    {v.size} / {v.color}
                  </strong>
                  <p>
                    {v.sku} · {v.isArchived ? "Archivada" : "Activa"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminButton
                    type="button"
                    disabled={busy || refreshFailed || !!pending}
                    onClick={() =>
                      guard(() => {
                        edit(v);
                        requestAnimationFrame(() =>
                          form.current?.querySelector("input")?.focus()
                        );
                      })
                    }
                  >
                    Editar {v.sku}
                  </AdminButton>
                  <AdminButton
                    type="button"
                    disabled={busy || refreshFailed || !!pending}
                    pending={busy && operation === v.id}
                    variant={v.isArchived ? "secondary" : "danger"}
                    onClick={() =>
                      guard(
                        () =>
                          void mutate(
                            v.id,
                            { version: v.version, isArchived: !v.isArchived },
                            v.id
                          )
                      )
                    }
                  >
                    {v.isArchived ? "Restaurar" : "Archivar"} {v.sku}
                  </AdminButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <form
          ref={form}
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            const input = selected
              ? { ...draft, version: selected.version }
              : { ...draft, productId: record.id };
            const parsed = (
              selected ? variantUpdateInput : variantInput
            ).safeParse(input);
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
            void mutate(selected?.id ?? null, parsed.data, "save");
          }}
        >
          <fieldset
            disabled={busy || refreshFailed || !!pending}
            className="space-y-4"
          >
            <legend>
              {selected
                ? "Editar variante"
                : "Nueva variante (stock inicial: 0)"}
            </legend>
            {(["size", "color", "colorHex", "sku"] as const).map((key, i) => (
              <label key={key}>
                {["Talla", "Color", "Color visual", "SKU"][i]}
                <input
                  name={key}
                  required
                  maxLength={key === "size" ? 30 : key === "sku" ? 80 : 60}
                  type={key === "colorHex" ? "color" : "text"}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((old) => ({ ...old, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-3">
              <AdminButton
                type="submit"
                variant="primary"
                pending={busy && operation === "save"}
              >
                {selected ? "Guardar variante" : "Agregar variante"}
              </AdminButton>
              {selected && (
                <AdminButton
                  type="button"
                  onClick={() => guard(() => edit(null))}
                >
                  Cancelar edición
                </AdminButton>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </AdminModal>
  );
}
