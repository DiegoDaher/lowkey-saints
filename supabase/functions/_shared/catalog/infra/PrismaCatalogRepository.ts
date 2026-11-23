import type { Prisma, PrismaClient } from "../../generated/prisma/client.ts";
import type { ICatalogRepository } from "../domain/CatalogFilters.ts";

// Only the fields a product card needs: no materials, specifications,
// measurements, SKUs or versions, and at most two images (primary + hover).
export const catalogCardSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  salePrice: true,
  isArchived: true,
  images: {
    select: { id: true, path: true, alt: true, position: true },
    orderBy: { position: "asc" },
    take: 2,
  },
  categories: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  variants: {
    where: { isArchived: false },
    select: { size: true, color: true, colorHex: true, stock: true },
    orderBy: { sku: "asc" },
  },
} satisfies Prisma.ProductSelect;

export type CatalogCardRow = Prisma.ProductGetPayload<{
  select: typeof catalogCardSelect;
}>;

export class PrismaCatalogRepository implements ICatalogRepository<CatalogCardRow> {
  constructor(private readonly db: PrismaClient) {}
  async findPage(query: {
    where: unknown;
    orderBy: unknown;
    skip: number;
    take: number;
  }) {
    const where = query.where as Prisma.ProductWhereInput;
    const [items, total] = await this.db.$transaction([
      this.db.product.findMany({
        where,
        select: catalogCardSelect,
        orderBy: query.orderBy as Prisma.ProductOrderByWithRelationInput[],
        skip: query.skip,
        take: query.take,
      }),
      this.db.product.count({ where }),
    ]);
    return { items, total };
  }
}
