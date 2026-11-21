"use client";
import { useEffect, useId, useRef, useState } from "react";
import AdminModal from "./AdminModal";
import AdminButton from "./AdminButton";
import ProductMediaEditor, { type ProductPhoto } from "./ProductMediaEditor";
import ProductDetailsSection from "./ProductDetailsSection";
import ProductLookSection from "./ProductLookSection";
import Spinner from "@/components/ui/Spinner";
import { ApiError } from "@/lib/api";
import {
  productInput,
  type CatalogProduct,
} from "../../../supabase/functions/_shared/contracts";
import {
  productDraft,
  productSections,
  fieldSection,
  type ProductDraft,
} from "./product-draft";
type Call = <T>(path: string, options?: RequestInit) => Promise<T>;
export default function ProductEditor({
  product,
  categories,
  call,
  onClose,
}: {
  product: CatalogProduct | null;
  categories: { id: string; name: string }[];
  call: Call;
  onClose: (changed: boolean) => void;
}) {
  const id = useId();
  const formId = id + "form";
  const productId = product?.id ?? null;
  const [record, setRecord] = useState(product);
  const [draft, setDraft] = useState<ProductDraft>(() => productDraft(product));
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(productDraft(product))
  );
  const [photos, setPhotos] = useState<ProductPhoto[]>(
    () => product?.images ?? []
  );
  const [related, setRelated] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(!!product);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const detailId = productId ?? (revision ? record?.id : null);
  const [tab, setTab] = useState(0);
  const [visited, setVisited] = useState([true, false, false, false]);
  const [busy, setBusy] = useState(false);
  const [savingClose, setSavingClose] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useRef(false);
  const changed = useRef(false);
  const focusField = useRef<string | null>(null);
  const dirty = JSON.stringify(draft) !== baseline || unresolved;
  useEffect(() => {
    if (!detailId) return;
    const controller = new AbortController();
    void call<CatalogProduct>("/admin/products/" + detailId, {
      signal: controller.signal,
    })
      .then((p) => {
        if (controller.signal.aborted) return;
        const value = productDraft(p);
        setRecord(p);
        setDraft(value);
        setBaseline(JSON.stringify(value));
        setPhotos(p.images);
        setRelated(p.complements?.map((c) => c.complementary) ?? []);
        setLoadFailed(false);
        setError("");
        setConflict(false);
        setUnresolved(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [detailId, call, revision]);
  useEffect(() => {
    if (!focusField.current) return;
    const field = document.getElementById(id + focusField.current);
    field?.focus();
    focusField.current = null;
  }, [errors, tab, id]);
  function update(patch: Partial<ProductDraft>) {
    setDraft((old) => ({ ...old, ...patch }));
    setNotice("");
  }
  function selectTab(next: number) {
    setTab(next);
    setVisited((old) => old.map((v, i) => v || i === next));
  }
  function fieldError(key: string) {
    return errors[key] ? (
      <small id={id + key + "error"} role="alert">
        {errors[key]}
      </small>
    ) : null;
  }
  function fieldProps(key: string) {
    return {
      id: id + key,
      "aria-invalid": !!errors[key],
      "aria-describedby": errors[key] ? id + key + "error" : undefined,
    };
  }
  async function save(close: boolean) {
    if (lock.current || loading || loadFailed || uploading || unresolved)
      return;
    const parsed = productInput.safeParse(draft);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        next[field] ??= issue.message;
      }
      const first = Object.keys(next)[0];
      focusField.current = first;
      selectTab(fieldSection[first] ?? 0);
      setErrors(next);
      setError("Revisa los campos indicados.");
      return;
    }
    lock.current = true;
    setSavingClose(close);
    setBusy(true);
    setError("");
    setErrors({});
    setNotice("");
    try {
      const saved = await call<CatalogProduct>(
        "/admin/products" + (record ? "/" + record.id : ""),
        { method: record ? "PUT" : "POST", body: JSON.stringify(parsed.data) }
      );
      const value = productDraft(saved, parsed.data.complementaryIds);
      setRecord(saved);
      setDraft(value);
      setBaseline(JSON.stringify(value));
      setPhotos(saved.images);
      changed.current = true;
      setConflict(false);
      setNotice("Prenda guardada. Puedes seguir completándola.");
      if (close) onClose(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar. Intenta de nuevo."
      );
      setConflict(e instanceof ApiError && e.status === 409);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function reload() {
    setConfirmReload(false);
    setLoading(true);
    setVisited([true, false, false, false]);
    setTab(0);
    setRevision((v) => v + 1);
  }
  const blocked = busy || loading || loadFailed;
  const navigation = (
    <div
      className="admin-modal-tabs"
      role="tablist"
      aria-label="Secciones de la prenda"
    >
      {productSections.map((label, i) => (
        <button
          type="button"
          role="tab"
          id={id + "tab" + i}
          aria-selected={tab === i}
          aria-controls={id + "panel" + i}
          tabIndex={tab === i ? 0 : -1}
          key={label}
          disabled={loading || loadFailed}
          onClick={() => selectTab(i)}
          onKeyDown={(e) => {
            let next = i;
            if (e.key === "ArrowRight") next = (i + 1) % 4;
            else if (e.key === "ArrowLeft") next = (i + 3) % 4;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = 3;
            else return;
            e.preventDefault();
            selectTab(next);
            document.getElementById(id + "tab" + next)?.focus();
          }}
        >
          {label}
          {Object.keys(errors).some((key) => fieldSection[key] === i) && (
            <span className="admin-tab-error" aria-label="Contiene errores">
              !
            </span>
          )}
        </button>
      ))}
    </div>
  );
  const panel = (index: number) => ({
    id: id + "panel" + index,
    role: "tabpanel" as const,
    "aria-labelledby": id + "tab" + index,
    hidden: tab !== index,
  });
  return (
    <AdminModal
      title={record ? "Editar producto: " + record.name : "Nuevo producto"}
      dirty={dirty}
      busy={busy || uploading}
      onClose={() => onClose(changed.current)}
      navigation={navigation}
      footer={
        <>
          <p role="status">
            {uploading
              ? "Subiendo fotografías…"
              : unresolved
                ? "Resuelve o elimina las fotografías pendientes antes de guardar."
                : dirty
                  ? "Cambios sin guardar"
                  : record
                    ? "Todos los cambios están guardados"
                    : "Completa los datos esenciales para crear la prenda."}
          </p>
          <div className="flex flex-wrap gap-3">
            <AdminButton
              type="submit"
              form={formId}
              pending={busy && !savingClose}
              disabled={blocked || uploading || unresolved}
              variant="primary"
            >
              Guardar cambios
            </AdminButton>
            <AdminButton
              type="button"
              disabled={blocked || uploading || unresolved}
              pending={busy && savingClose}
              onClick={() => void save(true)}
            >
              Guardar y cerrar
            </AdminButton>
          </div>
        </>
      }
    >
      {loading && <Spinner label="Cargando prenda…" />}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loadFailed && (
        <AdminButton type="button" onClick={reload}>
          Reintentar carga
        </AdminButton>
      )}
      {conflict && !confirmReload && (
        <AdminButton type="button" onClick={() => setConfirmReload(true)}>
          Recargar producto
        </AdminButton>
      )}
      {confirmReload && (
        <div className="admin-inline-confirm">
          <p>Recargar descartará los cambios sin guardar.</p>
          <AdminButton type="button" onClick={() => setConfirmReload(false)}>
            Seguir editando
          </AdminButton>
          <AdminButton type="button" variant="danger" onClick={reload}>
            Descartar y recargar
          </AdminButton>
        </div>
      )}
      {!loading && !loadFailed && (
        <form
          id={formId}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
        >
          <fieldset disabled={busy} className="min-w-0">
            <div {...panel(0)} className="space-y-5">
              <p>
                Completa estos datos para guardar la prenda. Las fotografías y
                los detalles pueden añadirse después.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  Nombre
                  <input
                    {...fieldProps("name")}
                    name="name"
                    required
                    value={draft.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                  {fieldError("name")}
                </label>
                <label>
                  Dirección del producto
                  <input
                    {...fieldProps("slug")}
                    name="slug"
                    required
                    value={draft.slug}
                    placeholder="camiseta-esencial"
                    onChange={(e) => update({ slug: e.target.value })}
                  />
                  {fieldError("slug")}
                </label>
                <label>
                  Precio de venta MXN
                  <input
                    {...fieldProps("salePrice")}
                    name="salePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={draft.salePrice}
                    onChange={(e) => update({ salePrice: e.target.value })}
                  />
                  {fieldError("salePrice")}
                </label>
                <label className="admin-check-label">
                  <input
                    name="archived"
                    type="checkbox"
                    checked={draft.isArchived}
                    onChange={(e) => update({ isArchived: e.target.checked })}
                  />{" "}
                  Archivar producto
                </label>
              </div>
              <fieldset id={id + "categoryIds"} tabIndex={-1}>
                <legend>Categorías (elige al menos una)</legend>
                {fieldError("categoryIds")}
                <div className="flex flex-wrap gap-5">
                  {categories.map((c) => (
                    <label className="admin-check-label" key={c.id}>
                      <input
                        type="checkbox"
                        name="category"
                        checked={draft.categoryIds.includes(c.id)}
                        onChange={(e) =>
                          update({
                            categoryIds: e.target.checked
                              ? [...draft.categoryIds, c.id]
                              : draft.categoryIds.filter((v) => v !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {!categories.length && (
                  <p>
                    No hay categorías disponibles. Cierra el editor y reintenta
                    su carga.
                  </p>
                )}
              </fieldset>
            </div>
            <div {...panel(1)}>
              <div id={id + "images"} tabIndex={-1}>
                {fieldError("images")}
                {visited[1] && (
                  <ProductMediaEditor
                    key={(record?.id ?? "new") + ":" + (record?.version ?? 0)}
                    initialImages={photos}
                    name={draft.name}
                    call={call}
                    disabled={busy}
                    onChange={(next) => {
                      setPhotos(next);
                      update({
                        images: next.map(({ path, alt }) => ({ path, alt })),
                      });
                    }}
                    onState={(active, pending) => {
                      setUploading(active);
                      setUnresolved(pending);
                    }}
                  />
                )}
              </div>
            </div>
            <div {...panel(2)}>
              <ProductDetailsSection
                draft={draft}
                update={update}
                error={fieldError}
                id={id}
              />
            </div>
            <div {...panel(3)}>
              <div id={id + "complementaryIds"} tabIndex={-1}>
                {fieldError("complementaryIds")}
                {visited[3] && (
                  <ProductLookSection
                    enabled={tab === 3}
                    productId={record?.id ?? null}
                    selected={draft.complementaryIds}
                    initialProducts={related}
                    onChange={(ids) => update({ complementaryIds: ids })}
                    call={call}
                    disabled={busy}
                  />
                )}
              </div>
            </div>
          </fieldset>
        </form>
      )}
    </AdminModal>
  );
}
