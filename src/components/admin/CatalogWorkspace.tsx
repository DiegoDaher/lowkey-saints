"use client";
import { useCategories } from "./useCategories";
import { AdminLoading } from "./AdminFeedback";
import AdminButton from "./AdminButton";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  saveProduct,
  setProductArchived,
  updateStock,
} from "@/modules/inventory/application/actions";
import {
  parseStockDraft,
  type StockDraft,
} from "@/modules/inventory/domain/stock-draft";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";
import ProductEditor from "./ProductEditor";
import InventoryMatrix from "./InventoryMatrix";
import VariantEditor from "./VariantEditor";

type Listing = { items: CatalogProduct[]; total: number };
export default function CatalogWorkspace({
  mode,
}: {
  mode: "productos" | "inventario";
  isAdmin: boolean;
}) {
  const [listing, setListing] = useState<Listing>({ items: [], total: 0 });
  const { categories, categoriesError, retryCategories } = useCategories();
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    state: "active",
    page: 1,
  });
  const [draft, setDraft] = useState<StockDraft>({});
  const [editorDirty, setEditorDirty] = useState(false);
  const [editing, setEditing] = useState<string | null | undefined>();
  const [variants, setVariants] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const bypass = useRef(false);
  const saving = useRef(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const count = Object.keys(draft).length;

  const call = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const {
        data: { session },
      } = await supabaseBrowser().auth.getSession();
      if (!session) {
        window.location.replace("/401");
        throw new Error("Inicia sesión");
      }
      try {
        return await api<T>(path, options, session.access_token);
      } catch (e) {
        if (e instanceof ApiError && [401, 403].includes(e.status))
          window.location.replace(
            e.status === 401 ? "/401" : "/140210/sin-acceso"
          );
        throw e;
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      ...filters,
      page: String(filters.page),
    });
    void call<Listing>("/admin/products?" + query, {
      signal: controller.signal,
    })
      .then((products) => {
        if (controller.signal.aborted) return;
        setListing(products);
        setLoadFailed(false);
        setConflict(false);
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setListing({ items: [], total: 0 });
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [call, filters, revision]);

  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);

  useEffect(() => {
    if (!count) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!bypass.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest(
        "a[href]"
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        event.ctrlKey ||
        event.metaKey ||
        anchor.target === "_blank" ||
        bypass.current
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPending(() => () => {
        bypass.current = true;
        window.location.assign(anchor.href);
      });
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (form.closest("[data-catalog-workspace]") || bypass.current) return;
      event.preventDefault();
      event.stopPropagation();
      const submitter = event.submitter;
      setPending(() => () => {
        bypass.current = true;
        form.requestSubmit(submitter);
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
    };
  }, [count]);

  function guard(next: () => void) {
    if (
      editing !== undefined &&
      editorDirty &&
      !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")
    )
      return;
    if (count) setPending(() => next);
    else next();
  }
  async function refresh() {
    setLoading(true);
    setRevision((v) => v + 1);
  }
  function failure(result: { status: number; message: string }) {
    setError(result.message);
    setConflict(result.status === 409);
    if ([401, 403].includes(result.status))
      window.location.replace(
        result.status === 401 ? "/401" : "/140210/sin-acceso"
      );
  }
  async function save() {
    if (saving.current) return false;
    saving.current = true;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await updateStock({ changes: parseStockDraft(draft) });
      if (!result.ok) {
        failure(result);
        return false;
      }
      setDraft({});
      setConflict(false);
      setMessage("Existencias guardadas");
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      return false;
    } finally {
      saving.current = false;
      setArchivingId(null);
      setBusy(false);
    }
  }
  const editorCall = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (
        /^\/admin\/products(?:\/[^/]+)?$/.test(path) &&
        ["POST", "PUT"].includes(options.method ?? "")
      ) {
        const productId =
          options.method === "PUT" ? path.split("/").at(-1)! : null;
        const result = await saveProduct(
          productId,
          JSON.parse(String(options.body))
        );
        if (!result.ok) throw new ApiError(result.status, result.message);
        return result as T;
      }
      return call<T>(path, options);
    },
    [call]
  );
  async function archive(product: CatalogProduct) {
    if (
      !window.confirm(
        `${product.isArchived ? "Restaurar" : "Archivar"} «${product.name}»? Se conservarán sus existencias y pedidos.`
      )
    )
      return;
    if (saving.current) return;
    saving.current = true;
    setArchivingId(product.id);
    setBusy(true);
    setError("");
    try {
      const result = await setProductArchived(product.id, {
        version: product.version,
        isArchived: !product.isArchived,
      });
      if (!result.ok) {
        failure(result);
        return;
      }
      setMessage(
        product.isArchived ? "Producto restaurado" : "Producto archivado"
      );
      await refresh();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      saving.current = false;
      setArchivingId(null);
      setBusy(false);
    }
  }

  return (
    <main
      data-catalog-workspace
      className="admin-form mx-auto w-full max-w-7xl space-y-6 p-6 md:p-10"
    >
      <h1 className="font-display text-4xl">
        {mode === "productos" ? "Catálogo de productos" : "Inventario"}
      </h1>
      <p role="alert">{error}</p>
      {categoriesError && (
        <div role="alert">
          No se pudieron cargar las categorías.{" "}
          <AdminButton type="button" onClick={retryCategories}>
            Reintentar categorías
          </AdminButton>
        </div>
      )}
      <p role="status">{message}</p>
      {loadFailed && (
        <AdminButton onClick={() => void refresh()}>
          Reintentar carga
        </AdminButton>
      )}
      {conflict && (
        <AdminButton
          onClick={() => {
            if (
              window.confirm(
                "Recargar descartará los cambios pendientes. ¿Continuar?"
              )
            ) {
              setDraft({});
              setConflict(false);
              setError("");
              void refresh();
            }
          }}
        >
          Recargar datos
        </AdminButton>
      )}
      <form
        key={JSON.stringify(filters)}
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const next = {
            q: String(form.get("q")),
            category: String(form.get("category")),
            state: String(form.get("state")),
            page: 1,
          };
          guard(() => {
            setLoading(true);
            setFilters(next);
            setEditing(undefined);
            setVariants(null);
          });
        }}
      >
        <label>
          Buscar por nombre
          <input name="q" defaultValue={filters.q} maxLength={100} />
        </label>
        <label>
          Categoría
          <select name="category" defaultValue={filters.category}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option value={c.name} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select name="state" defaultValue={filters.state}>
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <AdminButton disabled={busy || loading} className="shop-button">
          Aplicar filtros
        </AdminButton>
      </form>
      {loading && (
        <AdminLoading
          initial={!listing.items.length}
          label={
            listing.items.length
              ? "Actualizando catálogo…"
              : "Cargando catálogo…"
          }
        />
      )}
      {(!loading || listing.items.length > 0) && (
        <>
          {mode === "productos" ? (
            <>
              <AdminButton
                className="shop-button"
                disabled={busy || loading}
                onClick={() =>
                  guard(() => {
                    setEditing(null);
                    setVariants(null);
                  })
                }
              >
                Nuevo producto
              </AdminButton>
              {editing !== undefined && (
                <ProductEditor
                  key={editing ?? "new"}
                  product={listing.items.find((p) => p.id === editing) ?? null}
                  categories={categories}
                  call={editorCall}
                  onDirtyChange={setEditorDirty}
                  onClose={() => {
                    setEditorDirty(false);
                    setEditing(undefined);
                  }}
                  onSaved={async () => {
                    setEditorDirty(false);
                    setEditing(undefined);
                    await refresh();
                  }}
                />
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {["Producto", "Precio MXN", "Estado", "Acciones"].map(
                        (h) => (
                          <th scope="col" key={h}>
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {listing.items.map((p) => (
                      <tr key={p.id}>
                        <td className="p-3">
                          {p.images[0] && (
                            <Image
                              unoptimized
                              src={p.images[0].url}
                              alt={p.images[0].alt}
                              width={64}
                              height={80}
                            />
                          )}{" "}
                          {p.name}
                        </td>
                        <td>${p.salePrice}</td>
                        <td>{p.isArchived ? "Archivado" : "Activo"}</td>
                        <td>
                          <div className="flex flex-wrap gap-3">
                            <AdminButton
                              disabled={busy || loading}
                              onClick={() =>
                                guard(() => {
                                  setEditing(p.id);
                                  setVariants(null);
                                })
                              }
                            >
                              Editar {p.name}
                            </AdminButton>
                            <AdminButton
                              disabled={busy || loading}
                              onClick={() =>
                                guard(() => {
                                  setVariants(p.id);
                                  setEditing(undefined);
                                })
                              }
                            >
                              Variantes de {p.name}
                            </AdminButton>
                            <AdminButton
                              disabled={busy || loading}
                              pending={busy && archivingId === p.id}
                              variant={p.isArchived ? "secondary" : "danger"}
                              onClick={() => guard(() => void archive(p))}
                            >
                              {p.isArchived ? "Restaurar" : "Archivar"} {p.name}
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {listing.items
                .filter((p) => p.id === variants)
                .map((p) => (
                  <VariantEditor key={p.id} product={p} onSaved={refresh} />
                ))}
            </>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border bg-white p-4">
                <span>{count} / 100 celdas modificadas</span>
                <AdminButton
                  className="shop-button"
                  disabled={!count || busy || loading || conflict}
                  pending={busy}
                  onClick={() => void save()}
                >
                  Guardar cambios
                </AdminButton>
                <AdminButton
                  disabled={!count || busy || loading}
                  onClick={() => {
                    setDraft({});
                    setError("");
                  }}
                >
                  Descartar
                </AdminButton>
                {count >= 100 && (
                  <p>Guarda este lote antes de editar otras celdas.</p>
                )}
              </div>
              {listing.items.map((p) => (
                <InventoryMatrix
                  key={p.id}
                  product={p}
                  draft={draft}
                  disabled={busy || loading || loadFailed || conflict}
                  onChange={(v, value) => {
                    setMessage("");
                    setDraft((old) => {
                      const next = { ...old };
                      if (value !== "" && Number(value) === v.stock)
                        delete next[v.id];
                      else if (next[v.id] || Object.keys(next).length < 100)
                        next[v.id] = { id: v.id, version: v.version, value };
                      return next;
                    });
                  }}
                />
              ))}
            </>
          )}
          {!loadFailed && !listing.items.length && (
            <p>No hay productos para estos filtros.</p>
          )}
        </>
      )}
      <div className="flex gap-5">
        <AdminButton
          disabled={filters.page === 1 || busy || loading}
          onClick={() =>
            guard(() => {
              setLoading(true);
              setFilters((f) => ({ ...f, page: f.page - 1 }));
              setEditing(undefined);
              setVariants(null);
            })
          }
        >
          Anterior
        </AdminButton>
        <span>Página {filters.page}</span>
        <AdminButton
          disabled={filters.page * 24 >= listing.total || busy || loading}
          onClick={() =>
            guard(() => {
              setLoading(true);
              setFilters((f) => ({ ...f, page: f.page + 1 }));
              setEditing(undefined);
              setVariants(null);
            })
          }
        >
          Siguiente
        </AdminButton>
      </div>
      <dialog
        ref={dialog}
        className="m-auto max-w-lg space-y-4 border p-6 backdrop:bg-black/40"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setPending(null);
        }}
        aria-labelledby="pending-title"
      >
        <h2 id="pending-title" className="text-xl">
          Hay cambios sin guardar
        </h2>
        <p>Guarda o descarta las existencias modificadas antes de continuar.</p>
        <div className="flex flex-wrap gap-4">
          <AdminButton
            disabled={busy || loading || loadFailed || conflict}
            onClick={async () => {
              if (await save()) {
                const next = pending;
                setPending(null);
                next?.();
              }
            }}
          >
            Guardar y continuar
          </AdminButton>
          <AdminButton
            disabled={busy || loading}
            onClick={() => {
              setDraft({});
              setConflict(false);
              setError("");
              const next = pending;
              setPending(null);
              next?.();
            }}
          >
            Descartar y continuar
          </AdminButton>
          <AdminButton
            disabled={busy || loading}
            onClick={() => setPending(null)}
          >
            Cancelar
          </AdminButton>
        </div>
        {pending && error && <p role="alert">{error}</p>}
      </dialog>
    </main>
  );
}
