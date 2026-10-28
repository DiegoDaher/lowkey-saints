import type { CatalogProduct } from "../../supabase/functions/_shared/contracts";
import type { Product } from "@/types/product";
export function catalogProduct(p: CatalogProduct): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.categories[0]?.category.name || "Sin categoría",
    categories: p.categories.map((c) => c.category.name),
    price: Number(p.salePrice),
    currency: "MXN",
    images: {
      primary: p.images[0]?.url || "/images/hero-editorial.svg",
      alternate: p.images[1]?.url,
      gallery: p.images.map((i) => i.url),
    },
    sizes: [...new Set(p.variants.map((v) => v.size))],
    colors: [
      ...new Map(
        p.variants.map((v) => [v.color, { name: v.color, hex: v.colorHex }])
      ).values(),
    ],
    badge: p.variants.every((v) => v.stock === 0) ? "Agotado" : undefined,
  };
}
