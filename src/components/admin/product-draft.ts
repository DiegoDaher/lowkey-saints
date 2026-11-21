import type {
  CatalogProduct,
  ProductInput,
} from "../../../supabase/functions/_shared/contracts";
export type ProductDraft = ProductInput;
export function productDraft(
  p: CatalogProduct | null,
  complementaryIds = p?.complements?.map((c) => c.complementary.id) ?? []
): ProductDraft {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    description: p?.description ?? "",
    materials: p?.materials ?? "",
    specifications: p?.specifications ?? "",
    salePrice: p?.salePrice ?? "",
    isArchived: p?.isArchived ?? false,
    version: p?.version,
    categoryIds: p?.categories.map((c) => c.category.id) ?? [],
    images: p?.images.map((i) => ({ path: i.path, alt: i.alt })) ?? [],
    measurements:
      p?.measurements.map((m) => ({
        size: m.size,
        chestCm: m.chestCm,
        waistCm: m.waistCm,
        hipCm: m.hipCm,
      })) ?? [],
    modelHeightCm: p?.modelHeightCm ?? null,
    modelSize: p?.modelSize ?? null,
    complementaryIds,
  };
}
export const productSections = [
  "Datos esenciales",
  "Fotografías",
  "Detalles y medidas",
  "Completa el look",
];
export const fieldSection: Record<string, number> = {
  name: 0,
  slug: 0,
  salePrice: 0,
  categoryIds: 0,
  isArchived: 0,
  images: 1,
  description: 2,
  materials: 2,
  specifications: 2,
  measurements: 2,
  modelHeightCm: 2,
  modelSize: 2,
  complementaryIds: 3,
};
