import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { formatPrice } from "@/lib/format-price";
import type { Product } from "@/types/product";

interface ProductCardProps {
  onQuickView: (product: Product, trigger: HTMLButtonElement) => void;
  product: Product;
}

export function ProductCard({ onQuickView, product }: ProductCardProps) {
  const badge =
    product.badge ??
    (product.compareAtPrice && product.compareAtPrice > product.price
      ? "Oferta"
      : undefined);

  return (
    <article className="product-card min-w-0">
      <div className="group bg-bone relative aspect-[4/5] overflow-hidden">
        <Link
          aria-label={`Ver ${product.name}`}
          className="absolute inset-0"
          href={`/productos/${product.slug}`}
        >
          <Image
            alt={product.name}
            className="object-cover"
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
            src={product.images.primary}
          />
          {product.images.alternate && (
            <Image
              alt={`${product.name}, vista alternativa`}
              className="product-card__alternate object-cover"
              fill
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
              src={product.images.alternate}
            />
          )}
        </Link>

        {badge && (
          <span className="bg-paper text-ink absolute top-2 left-2 z-10 px-2 py-1 text-[0.58rem] font-bold tracking-[0.1em] uppercase sm:top-3 sm:left-3 sm:px-2.5 sm:text-[0.65rem]">
            {badge}
          </span>
        )}

        <button
          aria-label={`Vista rápida de ${product.name}`}
          className="quick-view-trigger bg-paper/95 text-ink absolute right-2 bottom-2 z-10 inline-flex min-h-10 items-center gap-2 px-3 text-[0.65rem] font-bold tracking-[0.08em] transition-all duration-200 sm:right-3 sm:bottom-3"
          onClick={(event) => onQuickView(product, event.currentTarget)}
          type="button"
        >
          <Eye aria-hidden="true" size={16} strokeWidth={1.7} />
          <span>VISTA RÁPIDA</span>
        </button>
      </div>

      <div className="pt-3 sm:pt-4">
        <Link className="block" href={`/productos/${product.slug}`}>
          <h3 className="font-display line-clamp-2 min-h-10 text-base leading-5 font-semibold tracking-[0.04em] uppercase sm:text-lg">
            {product.name}
          </h3>
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className={badge === "Agotado" ? "text-muted" : "font-medium"}>
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-sale text-xs line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
        {product.colors && product.colors.length > 0 && (
          <ul
            aria-label={`Colores disponibles: ${product.colors.map((color) => color.name).join(", ")}`}
            className="mt-3 flex gap-1.5"
          >
            {product.colors.map((color) => (
              <li
                aria-label={color.name}
                className="border-ink/15 size-3 rounded-full border"
                key={color.name}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="bg-bone aspect-[4/5]" />
      <div className="bg-bone mt-4 h-4 w-3/4" />
      <div className="bg-bone mt-3 h-4 w-1/3" />
    </div>
  );
}
