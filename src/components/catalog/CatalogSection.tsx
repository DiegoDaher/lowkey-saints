"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { catalogProduct } from "@/lib/catalog-product";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";
import type { Product } from "@/types/product";
import CatalogFilterDialog from "@/components/catalog/CatalogFilterDialog";
import {
  useCatalogFilters,
  type ProductCategory,
} from "@/components/catalog/CatalogFilterProvider";
import CatalogToolbar from "@/components/catalog/CatalogToolbar";
import ProductGrid from "@/components/catalog/ProductGrid";

export default function CatalogSection() {
  const { filters, setFilters } = useCatalogFilters();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("relevancia");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(["Todas"]);
  const [page, setPage] = useState(1);
  const [lastFilters, setLastFilters] = useState(filters);
  if (lastFilters !== filters) {
    setLastFilters(filters);
    setPage(1);
  }
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          page: String(page),
          sort: sortOrder,
        });
        if (filters.category !== "Todas")
          query.set("category", filters.category);
        if (filters.minPrice) query.set("min", filters.minPrice);
        if (filters.maxPrice) query.set("max", filters.maxPrice);
        filters.sizes.forEach((v) => query.append("size", v));
        filters.colors.forEach((v) => query.append("color", v));
        const result = await api<{
          items: CatalogProduct[];
          total: number;
          pages: number;
        }>("/products?" + query, { signal: controller.signal });
        setProducts(result.items.map(catalogProduct));
        setTotal(result.total);
        setPages(result.pages);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, page, sortOrder]);
  useEffect(() => {
    api<{ name: string }[]>("/categories")
      .then((rows) => setCategories(["Todas", ...rows.map((r) => r.name)]))
      .catch(() => {});
  }, []);

  const activeFilterCount =
    Number(filters.category !== "Todas") +
    Number(filters.minPrice !== "") +
    Number(filters.maxPrice !== "") +
    filters.sizes.length +
    filters.colors.length;

  function closeFilterDialog() {
    setFilterDialogOpen(false);
    window.requestAnimationFrame(() =>
      document.getElementById("catalog-filter-trigger")?.focus()
    );
  }

  return (
    <section
      aria-labelledby="catalog-title"
      className="mx-auto w-full max-w-[1440px] scroll-mt-24 px-4 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24"
      id="catalogo"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
        <div>
          <p className="text-muted mb-2 text-[0.65rem] font-semibold tracking-[0.18em] uppercase">
            Lowkey Saints / Selección
          </p>
          <h2
            className="font-display text-4xl leading-none font-bold tracking-[0.04em] uppercase sm:text-5xl"
            id="catalog-title"
          >
            Piezas esenciales
          </h2>
        </div>
        <p className="text-muted hidden max-w-xs text-right text-sm leading-6 md:block">
          Una selección para todos los días, sin perder tu propia frecuencia.
        </p>
      </div>

      <CatalogToolbar
        activeFilterCount={activeFilterCount}
        onFilter={() => setFilterDialogOpen(true)}
        onSortChange={(value) => {
          setSortOrder(value);
          setPage(1);
        }}
        productCount={total}
        sortOrder={sortOrder}
      />
      {loading ? (
        <p className="py-10" role="status">
          Cargando productos…
        </p>
      ) : error ? (
        <p role="alert" className="py-10">
          {error}
        </p>
      ) : (
        <ProductGrid products={products} />
      )}
      <div className="mt-8 flex items-center justify-center gap-5">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span>
          {page} / {Math.max(1, pages)}
        </span>
        <button
          disabled={page >= pages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </button>
      </div>
      {filterDialogOpen && (
        <CatalogFilterDialog
          categories={categories}
          filters={filters}
          onApply={(nextFilters) => {
            setFilters(nextFilters);
            setPage(1);
            closeFilterDialog();
          }}
          onClose={closeFilterDialog}
          products={products}
        />
      )}
    </section>
  );
}
