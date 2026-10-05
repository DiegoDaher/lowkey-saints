"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type {
  CatalogFilters,
  ProductCategory,
} from "@/components/catalog/CatalogFilterProvider";
import type { Product } from "@/types/product";

interface CatalogFilterDialogProps {
  categories: ProductCategory[];
  filters: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
  onClose: () => void;
  products: Product[];
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];
}

export default function CatalogFilterDialog({
  categories,
  filters,
  onApply,
  onClose,
  products,
}: CatalogFilterDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [priceError, setPriceError] = useState("");
  const availableSizes = Array.from(
    new Set(products.flatMap((product) => product.sizes ?? []))
  ).sort((first, second) => first.localeCompare(second, "es"));
  const availableColors = Array.from(
    new Map(
      products.flatMap((product) =>
        (product.colors ?? []).map((color) => [color.name, color] as const)
      )
    ).values()
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function applyFilters() {
    const minimum = draftFilters.minPrice
      ? Number(draftFilters.minPrice)
      : undefined;
    const maximum = draftFilters.maxPrice
      ? Number(draftFilters.maxPrice)
      : undefined;

    if (
      (minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0)) ||
      (maximum !== undefined && (!Number.isFinite(maximum) || maximum < 0)) ||
      (minimum !== undefined && maximum !== undefined && minimum > maximum)
    ) {
      setPriceError(
        "Revisa el rango: el precio mínimo debe ser menor al máximo."
      );
      return;
    }

    setPriceError("");
    onApply(draftFilters);
  }

  return (
    <dialog
      aria-labelledby="catalog-filter-title"
      aria-modal="true"
      className="quick-view-dialog bg-paper text-ink backdrop:bg-ink/55 fixed inset-x-0 bottom-0 m-0 max-h-[92svh] w-full max-w-none overflow-y-auto p-0 md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[88svh] md:w-[min(92vw,36rem)] md:-translate-x-1/2 md:-translate-y-1/2"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      ref={dialogRef}
    >
      <div className="border-line bg-paper sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 sm:px-7">
        <h2
          className="font-display text-2xl font-bold tracking-[0.08em] uppercase"
          id="catalog-filter-title"
        >
          Filtrar productos
        </h2>
        <button
          aria-label="Cerrar filtros"
          className="flex size-11 items-center justify-center"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={21} />
        </button>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        <div>
          <label
            className="mb-3 block text-xs font-semibold tracking-[0.1em] uppercase"
            htmlFor="filter-category"
          >
            Categoría
          </label>
          <select
            className="border-line bg-paper min-h-11 w-full border px-3 text-sm"
            id="filter-category"
            onChange={(event) => {
              const category = categories.find(
                (option) => option === event.target.value
              );
              if (category) {
                setDraftFilters({ ...draftFilters, category });
              }
            }}
            value={draftFilters.category}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="mb-3 text-xs font-semibold tracking-[0.1em] uppercase">
            Precio (MXN)
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-muted text-xs">
              Desde
              <input
                className="border-line text-ink mt-2 min-h-11 w-full border px-3 text-sm"
                inputMode="numeric"
                min="0"
                onChange={(event) => {
                  setPriceError("");
                  setDraftFilters({
                    ...draftFilters,
                    minPrice: event.target.value,
                  });
                }}
                placeholder="Sin mínimo"
                type="number"
                value={draftFilters.minPrice}
              />
            </label>
            <label className="text-muted text-xs">
              Hasta
              <input
                className="border-line text-ink mt-2 min-h-11 w-full border px-3 text-sm"
                inputMode="numeric"
                min="0"
                onChange={(event) => {
                  setPriceError("");
                  setDraftFilters({
                    ...draftFilters,
                    maxPrice: event.target.value,
                  });
                }}
                placeholder="Sin máximo"
                type="number"
                value={draftFilters.maxPrice}
              />
            </label>
          </div>
          {priceError && (
            <p className="text-sale mt-2 text-sm" role="alert">
              {priceError}
            </p>
          )}
        </fieldset>

        {availableSizes.length > 0 && (
          <fieldset>
            <legend className="mb-3 text-xs font-semibold tracking-[0.1em] uppercase">
              Talla
            </legend>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((size) => (
                <label
                  className={`flex min-h-10 min-w-11 cursor-pointer items-center justify-center border px-3 text-xs ${
                    draftFilters.sizes.includes(size)
                      ? "border-ink bg-ink text-paper"
                      : "border-line"
                  }`}
                  key={size}
                >
                  <input
                    checked={draftFilters.sizes.includes(size)}
                    className="sr-only"
                    onChange={() =>
                      setDraftFilters({
                        ...draftFilters,
                        sizes: toggleValue(draftFilters.sizes, size),
                      })
                    }
                    type="checkbox"
                    value={size}
                  />
                  {size}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {availableColors.length > 0 && (
          <fieldset>
            <legend className="mb-3 text-xs font-semibold tracking-[0.1em] uppercase">
              Color
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {availableColors.map((color) => (
                <label
                  className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"
                  key={color.name}
                >
                  <input
                    checked={draftFilters.colors.includes(color.name)}
                    className="accent-ink size-4"
                    onChange={() =>
                      setDraftFilters({
                        ...draftFilters,
                        colors: toggleValue(draftFilters.colors, color.name),
                      })
                    }
                    type="checkbox"
                    value={color.name}
                  />
                  <span
                    aria-hidden="true"
                    className="border-ink/15 size-4 rounded-full border"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="border-line bg-paper sticky bottom-0 flex gap-3 border-t px-5 py-4 sm:px-7">
        <button
          className="border-line hover:border-ink min-h-12 flex-1 border px-4 text-xs font-bold tracking-[0.1em] transition-colors"
          onClick={() => {
            setDraftFilters({
              category: "Todas",
              minPrice: "",
              maxPrice: "",
              sizes: [],
              colors: [],
            });
            setPriceError("");
          }}
          type="button"
        >
          LIMPIAR
        </button>
        <button
          className="bg-ink text-paper hover:bg-muted min-h-12 flex-1 px-4 text-xs font-bold tracking-[0.1em] transition-colors"
          onClick={applyFilters}
          type="button"
        >
          APLICAR FILTROS
        </button>
      </div>
    </dialog>
  );
}
