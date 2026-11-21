"use client";
import AdminButton from "./AdminButton";
import Loader from "@/components/ui/Loader";
import { useEffect, useRef, useState } from "react";
import ProductMediaEditor from "./ProductMediaEditor";
import { ApiError } from "@/lib/api";
import { productInput } from "../../../supabase/functions/_shared/contracts";
import type {
  CatalogProduct,
  ProductInput,
} from "../../../supabase/functions/_shared/contracts";
type Call = <T>(path: string, options?: RequestInit) => Promise<T>;
export default function ProductEditor({
  product: p,
  categories,
  call,
  onClose,
  onSaved,
  onDirtyChange,
}: {
  product: CatalogProduct | null;
  categories: { id: string; name: string }[];
  call: Call;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [images, setImages] = useState(
    p?.images.map((i) => ({ path: i.path, alt: i.alt, url: i.url })) || []
  );
  const [measurements, setMeasurements] = useState(
    p?.measurements.map((m) => ({ ...m })) || []
  );
  const [complements, setComplements] = useState<string[]>([]);
  const [options, setOptions] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saved = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a[href]");
      if (
        !saved.current &&
        anchor &&
        !event.ctrlKey &&
        !event.metaKey &&
        anchor.getAttribute("target") !== "_blank" &&
        !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const submit = (event: SubmitEvent) => {
      if (
        !(event.target as HTMLFormElement).closest("[data-product-editor]") &&
        !saved.current &&
        !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("submit", submit, true);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      document.removeEventListener("submit", submit, true);
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const [searchLoading, setSearchLoading] = useState(true);
  const [complementsLoading, setComplementsLoading] = useState(Boolean(p));
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      setSearchLoading(true);
      try {
        const result = await call<{ items: CatalogProduct[] }>(
          "/admin/products?q=" + encodeURIComponent(search),
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) setOptions(result.items);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) void loadOptions();
    });
    return () => controller.abort();
  }, [call, search]);
  useEffect(() => {
    if (!p) return;
    const controller = new AbortController();
    void call<CatalogProduct>("/admin/products/" + p.id, {
      signal: controller.signal,
    })
      .then((v) => {
        if (!controller.signal.aborted)
          setComplements(v.complements?.map((c) => c.complementary.id) || []);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setComplementsLoading(false);
      });
    return () => controller.abort();
  }, [call, p]);
  return (
    <section className="space-y-5 border bg-stone-50 p-6">
      <div className="flex justify-between">
        <h2 className="text-2xl">{p ? "Editar producto" : "Nuevo producto"}</h2>
        <AdminButton
          onClick={() => {
            if (
              !dirty ||
              window.confirm("Hay cambios sin guardar. ¿Descartarlos?")
            )
              onClose();
          }}
          disabled={busy || uploading}
        >
          Cerrar
        </AdminButton>
      </div>
      <p role="alert">{error}</p>
      {conflict && (
        <AdminButton
          type="button"
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
          Recargar producto
        </AdminButton>
      )}
      <form
        data-product-editor
        className="space-y-4"
        onChange={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting.current || busy || uploading || unresolved) return;
          submitting.current = true;
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          setFieldErrors({});
          setConflict(false);
          try {
            const input: ProductInput = {
              name: String(f.get("name")),
              slug: String(f.get("slug")),
              description: String(f.get("description")),
              materials: String(f.get("materials")),
              specifications: String(f.get("specifications")),
              salePrice: String(f.get("salePrice")),
              isArchived: f.get("archived") === "on",
              version: p?.version,
              modelHeightCm: String(f.get("height")) || null,
              modelSize: String(f.get("modelSize")) || null,
              categoryIds: f.getAll("category").map(String),
              images: images.map(({ path, alt }) => ({ path, alt })),
              measurements: measurements.map((m) => ({
                size: m.size,
                chestCm: m.chestCm || null,
                waistCm: m.waistCm || null,
                hipCm: m.hipCm || null,
              })),
              complementaryIds: complements,
            };
            const parsed = productInput.safeParse(input);
            if (!parsed.success) {
              setFieldErrors(
                Object.fromEntries(
                  parsed.error.issues.map((issue) => [
                    String(issue.path[0]),
                    issue.message,
                  ])
                )
              );
              throw new Error("Revisa los campos indicados");
            }
            await call("/admin/products" + (p ? "/" + p.id : ""), {
              method: p ? "PUT" : "POST",
              body: JSON.stringify(input),
            });
            saved.current = true;
            setDirty(false);
            await onSaved();
          } catch (e) {
            setError((e as Error).message);
            setConflict(e instanceof ApiError && e.status === 409);
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || complementsLoading} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              Nombre
              <input name="name" required defaultValue={p?.name} />
              <small role="alert">{fieldErrors.name}</small>
            </label>
            <label>
              Dirección del producto
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="camiseta-esencial"
                defaultValue={p?.slug}
              />
              <small role="alert">{fieldErrors.slug}</small>
            </label>
            <label>
              Precio de venta MXN
              <input
                name="salePrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={p?.salePrice}
              />
              <small role="alert">{fieldErrors.salePrice}</small>
            </label>
            <label>
              <input
                name="archived"
                type="checkbox"
                defaultChecked={p?.isArchived}
              />{" "}
              Archivar producto
            </label>
          </div>
          <label>
            Descripción
            <textarea
              name="description"
              rows={3}
              defaultValue={p?.description}
            />
            <small role="alert">{fieldErrors.description}</small>
          </label>
          <label>
            Materiales
            <textarea name="materials" defaultValue={p?.materials} />
            <small role="alert">{fieldErrors.materials}</small>
          </label>
          <label>
            Especificaciones
            <textarea name="specifications" defaultValue={p?.specifications} />
            <small role="alert">{fieldErrors.specifications}</small>
          </label>
          <fieldset>
            <legend>Categorías</legend>
            <small role="alert">{fieldErrors.categoryIds}</small>
            <div className="flex flex-wrap gap-5">
              {categories.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    name="category"
                    value={c.id}
                    defaultChecked={p?.categories.some(
                      (x) => x.category.id === c.id
                    )}
                  />{" "}
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <ProductMediaEditor
            initialImages={images}
            name={p?.name || ""}
            call={call}
            disabled={busy || complementsLoading}
            onChange={(next) => {
              setImages(next);
              setDirty(true);
            }}
            onState={(active, pending) => {
              setUploading(active);
              setUnresolved(pending);
            }}
          />
          <small role="alert">{fieldErrors.images}</small>
          <fieldset>
            <legend>Medidas por talla (cm)</legend>
            <small role="alert">{fieldErrors.measurements}</small>
            {measurements.map((m, i) => (
              <div className="grid grid-cols-5 gap-2" key={i}>
                {(["size", "chestCm", "waistCm", "hipCm"] as const).map(
                  (field, n) => (
                    <label key={field}>
                      {["Talla", "Pecho", "Cintura", "Cadera"][n]}
                      <input
                        value={m[field] || ""}
                        type={field === "size" ? "text" : "number"}
                        min="0.01"
                        step="0.01"
                        required={field === "size"}
                        onChange={(e) =>
                          setMeasurements((old) =>
                            old.map((v, j) =>
                              j === i ? { ...v, [field]: e.target.value } : v
                            )
                          )
                        }
                      />
                    </label>
                  )
                )}
                <AdminButton
                  type="button"
                  onClick={() =>
                    setMeasurements((old) => old.filter((_, j) => j !== i))
                  }
                >
                  Quitar
                </AdminButton>
              </div>
            ))}
            <AdminButton
              type="button"
              className="underline"
              onClick={() =>
                setMeasurements((old) => [
                  ...old,
                  { size: "", chestCm: null, waistCm: null, hipCm: null },
                ])
              }
            >
              Agregar talla
            </AdminButton>
          </fieldset>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              Estatura del modelo (cm)
              <input
                name="height"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={p?.modelHeightCm || ""}
              />
              <small role="alert">{fieldErrors.modelHeightCm}</small>
            </label>
            <label>
              Talla usada por el modelo
              <input name="modelSize" defaultValue={p?.modelSize || ""} />
              <small role="alert">{fieldErrors.modelSize}</small>
            </label>
          </div>
          <fieldset>
            <legend>Completa el look (máximo 3)</legend>
            <small role="alert">{fieldErrors.complementaryIds}</small>
            <label>
              Buscar productos
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {(searchLoading || complementsLoading) && (
              <Loader variant="inline" label="Cargando complementos…" />
            )}
            <p>{complements.length} seleccionados</p>
            {options
              .filter((o) => o.id !== p?.id)
              .map((o) => (
                <label key={o.id}>
                  <input
                    type="checkbox"
                    checked={complements.includes(o.id)}
                    disabled={
                      busy ||
                      searchLoading ||
                      complementsLoading ||
                      (!complements.includes(o.id) && complements.length >= 3)
                    }
                    onChange={(e) =>
                      setComplements((old) =>
                        e.target.checked
                          ? [...old, o.id]
                          : old.filter((id) => id !== o.id)
                      )
                    }
                  />{" "}
                  {o.name}
                </label>
              ))}
          </fieldset>
          <AdminButton
            disabled={busy || uploading || unresolved || complementsLoading}
            aria-busy={busy}
            className="shop-button"
          >
            {busy && !uploading ? (
              <Loader announce={false} variant="inline" label="Guardando…" />
            ) : (
              "Guardar producto"
            )}
          </AdminButton>
        </fieldset>
      </form>
    </section>
  );
}
