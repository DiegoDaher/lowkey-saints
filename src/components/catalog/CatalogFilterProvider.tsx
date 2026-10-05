"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/types/product";

export type ProductCategory = "Todas" | Product["category"];

export interface CatalogFilters {
  category: ProductCategory;
  minPrice: string;
  maxPrice: string;
  sizes: string[];
  colors: string[];
}

interface CatalogFilterContextValue {
  filters: CatalogFilters;
  setFilters: (filters: CatalogFilters) => void;
  setCategory: (category: ProductCategory) => void;
}

const initialFilters: CatalogFilters = {
  category: "Todas",
  minPrice: "",
  maxPrice: "",
  sizes: [],
  colors: [],
};

const CatalogFilterContext = createContext<CatalogFilterContextValue | null>(
  null
);

export function CatalogFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(initialFilters);
  const value = useMemo(
    () => ({
      filters,
      setFilters,
      setCategory: (category: ProductCategory) =>
        setFilters((currentFilters) => ({ ...currentFilters, category })),
    }),
    [filters]
  );

  return (
    <CatalogFilterContext.Provider value={value}>
      {children}
    </CatalogFilterContext.Provider>
  );
}

export function useCatalogFilters() {
  const context = useContext(CatalogFilterContext);

  if (!context) {
    throw new Error(
      "useCatalogFilters debe usarse dentro de CatalogFilterProvider."
    );
  }

  return context;
}
