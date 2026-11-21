"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";
import AdminButton from "./AdminButton";
import Spinner from "@/components/ui/Spinner";
type Call = <T>(path: string, options?: RequestInit) => Promise<T>;
export default function ProductLookSection({
  enabled,
  productId,
  selected,
  initialProducts,
  onChange,
  call,
  disabled,
}: {
  enabled: boolean;
  productId: string | null;
  selected: string[];
  initialProducts: CatalogProduct[];
  onChange: (ids: string[]) => void;
  call: Call;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    items: CatalogProduct[];
    total: number;
  }>({ items: [], total: 0 });
  const [known, setKnown] = useState<Record<string, CatalogProduct>>(() =>
    Object.fromEntries(initialProducts.map((p) => [p.id, p]))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void call<typeof result>(
        "/admin/products?" +
          new URLSearchParams({
            q: search,
            state: "active",
            page: String(page),
          }),
        { signal: controller.signal }
      )
        .then((value) => {
          if (controller.signal.aborted) return;
          setResult(value);
          setKnown((old) => ({
            ...old,
            ...Object.fromEntries(value.items.map((p) => [p.id, p])),
          }));
          setError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, search, page, revision, call]);
  function card(p: CatalogProduct, chosen: boolean) {
    return (
      <label key={p.id} className="admin-look-card" data-selected={chosen}>
        <span className="admin-look-image">
          {p.images[0]?.url ? (
            <Image
              src={p.images[0].url}
              alt={p.images[0].alt || p.name}
              width={160}
              height={190}
              unoptimized
              loading="lazy"
            />
          ) : (
            <span>Sin imagen</span>
          )}
        </span>
        <span className="admin-look-caption">
          <input
            type="checkbox"
            aria-label={`Complementar con ${p.name}`}
            checked={chosen}
            disabled={disabled || (!chosen && selected.length >= 3)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, p.id]
                  : selected.filter((id) => id !== p.id)
              )
            }
          />
          <span>
            {p.name}
            {p.isArchived && <small className="block">Archivada</small>}
          </span>
        </span>
      </label>
    );
  }
  return (
    <div className="space-y-5">
      <p>Selecciona hasta tres prendas para acompañar este producto.</p>
      <section aria-label="Prendas seleccionadas">
        <h3>{selected.length} de 3 seleccionadas</h3>
        <div className="admin-look-grid">
          {selected.map((id) =>
            known[id] ? (
              card(known[id], true)
            ) : (
              <div key={id}>
                Prenda no disponible{" "}
                <AdminButton
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(selected.filter((v) => v !== id))}
                >
                  Quitar selección
                </AdminButton>
              </div>
            )
          )}
        </div>
      </section>
      <label>
        Buscar productos
        <input
          value={search}
          maxLength={100}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        />
      </label>
      {loading && <Spinner label="Buscando prendas…" />}
      {error && (
        <div role="alert">
          {error}{" "}
          <AdminButton
            type="button"
            onClick={() => {
              setLoading(true);
              setRevision((v) => v + 1);
            }}
          >
            Reintentar búsqueda
          </AdminButton>
        </div>
      )}
      <div className="admin-look-grid" aria-busy={loading}>
        {result.items
          .filter((p) => p.id !== productId && !selected.includes(p.id))
          .map((p) => card(p, false))}
      </div>
      {!loading &&
        !error &&
        !result.items.some(
          (p) => p.id !== productId && !selected.includes(p.id)
        ) && <p>No hay más prendas para esta búsqueda.</p>}
      <nav
        className="flex items-center gap-3"
        aria-label="Paginación de complementos"
      >
        <AdminButton
          type="button"
          disabled={loading || page === 1}
          onClick={() => {
            setPage((v) => v - 1);
            setLoading(true);
          }}
        >
          Anterior
        </AdminButton>
        <span>Página {page}</span>
        <AdminButton
          type="button"
          disabled={loading || page * 24 >= result.total}
          onClick={() => {
            setPage((v) => v + 1);
            setLoading(true);
          }}
        >
          Siguiente
        </AdminButton>
      </nav>
    </div>
  );
}
