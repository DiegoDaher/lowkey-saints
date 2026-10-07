"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/types/product";
import CatalogFilterDialog from "@/components/catalog/CatalogFilterDialog";
import {
  useCatalogFilters,
  type ProductCategory,
} from "@/components/catalog/CatalogFilterProvider";
import CatalogToolbar from "@/components/catalog/CatalogToolbar";
import ProductGrid from "@/components/catalog/ProductGrid";

interface CatalogSectionProps {
  products: Product[];
}

export default function CatalogSection({ products }: CatalogSectionProps) {
  const { filters, setFilters } = useCatalogFilters();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("relevancia");
  const categories: ProductCategory[] = [
    "Todas",
    ...Array.from(new Set(products.map((product) => product.category))),
  ];

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory =
        filters.category === "Todas" || product.category === filters.category;
      const minimum =
        filters.minPrice === "" ? undefined : Number(filters.minPrice);
      const maximum =
        filters.maxPrice === "" ? undefined : Number(filters.maxPrice);
      const matchesPrice =
        (minimum === undefined || product.price >= minimum) &&
        (maximum === undefined || product.price <= maximum);
      const matchesSize =
        filters.sizes.length === 0 ||
        filters.sizes.some((size) => product.sizes?.includes(size));
      const matchesColor =
        filters.colors.length === 0 ||
        filters.colors.some((color) =>
          product.colors?.some((productColor) => productColor.name === color)
        );

      return matchesCategory && matchesPrice && matchesSize && matchesColor;
    });

    if (sortOrder === "precio-asc") {
      filtered.sort((first, second) => first.price - second.price);
    } else if (sortOrder === "precio-desc") {
      filtered.sort((first, second) => second.price - first.price);
    } else if (sortOrder === "novedades") {
      filtered.reverse();
    }

    return filtered;
  }, [filters, products, sortOrder]);

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
        onSortChange={setSortOrder}
        productCount={filteredProducts.length}
        sortOrder={sortOrder}
      />
      <ProductGrid products={filteredProducts} />
      {filterDialogOpen && (
        <CatalogFilterDialog
          categories={categories}
          filters={filters}
          onApply={(nextFilters) => {
            setFilters(nextFilters);
            closeFilterDialog();
          }}
          onClose={closeFilterDialog}
          products={products}
        />
      )}
    </section>
  );
}
