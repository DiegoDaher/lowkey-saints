import { SlidersHorizontal } from "lucide-react";

interface CatalogToolbarProps {
  activeFilterCount: number;
  onFilter: () => void;
  onSortChange: (sortOrder: string) => void;
  productCount: number;
  sortOrder: string;
}

export default function CatalogToolbar({
  activeFilterCount,
  onFilter,
  onSortChange,
  productCount,
  sortOrder,
}: CatalogToolbarProps) {
  return (
    <div className="border-line flex flex-wrap items-center justify-between gap-4 border-y py-4">
      <p aria-live="polite" className="text-muted text-xs sm:text-sm">
        {productCount} {productCount === 1 ? "producto" : "productos"}
      </p>

      <div className="flex items-center gap-3 sm:gap-6">
        <label className="text-muted flex items-center gap-2 text-xs sm:text-sm">
          <span className="hidden sm:inline">Ordenar por</span>
          <select
            aria-label="Ordenar productos"
            className="bg-paper text-ink min-h-10 font-medium focus-visible:outline-offset-2"
            onChange={(event) => onSortChange(event.target.value)}
            value={sortOrder}
          >
            <option value="relevancia">Relevancia</option>
            <option value="novedades">Más recientes</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
          </select>
        </label>
        <button
          aria-label={
            activeFilterCount > 0
              ? `Filtrar productos, ${activeFilterCount} filtros activos`
              : "Filtrar productos"
          }
          className="border-line hover:border-ink min-h-10 border px-4 text-xs font-bold tracking-[0.1em] transition-colors sm:text-sm"
          id="catalog-filter-trigger"
          onClick={onFilter}
          type="button"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" size={15} />
            FILTRAR
            {activeFilterCount > 0 && (
              <span aria-hidden="true" className="text-gold">
                {activeFilterCount}
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
