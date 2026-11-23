import type { Prisma } from "../../generated/prisma/client.ts";
import type {
  CatalogFilters,
  CatalogPage,
  ICatalogRepository,
} from "../domain/CatalogFilters.ts";

export const CATALOG_PAGE_SIZE = 24;

export function catalogWhere(
  filters: CatalogFilters
): Prisma.ProductWhereInput {
  const { category, q, min, max, sizes, colors } = filters;
  return {
    isArchived: false,
    ...(category
      ? {
          categories: {
            some: {
              category: { OR: [{ slug: category }, { name: category }] },
            },
          },
        }
      : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(min || max
      ? {
          salePrice: {
            ...(min ? { gte: min } : {}),
            ...(max ? { lte: max } : {}),
          },
        }
      : {}),
    ...(sizes.length || colors.length
      ? {
          variants: {
            some: {
              isArchived: false,
              ...(sizes.length ? { size: { in: sizes } } : {}),
              ...(colors.length ? { color: { in: colors } } : {}),
            },
          },
        }
      : {}),
  };
}

export function catalogOrderBy(
  sort: CatalogFilters["sort"]
): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "precio-asc") return [{ salePrice: "asc" }, { id: "asc" }];
  if (sort === "precio-desc") return [{ salePrice: "desc" }, { id: "asc" }];
  return [{ createdAt: "desc" }, { id: "asc" }];
}

export class GetCatalogFilteredUseCase<T> {
  constructor(private readonly repository: ICatalogRepository<T>) {}
  async execute(filters: CatalogFilters): Promise<CatalogPage<T>> {
    const { items, total } = await this.repository.findPage({
      where: catalogWhere(filters),
      orderBy: catalogOrderBy(filters.sort),
      skip: (filters.page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    });
    return {
      items,
      total,
      page: filters.page,
      pages: Math.ceil(total / CATALOG_PAGE_SIZE),
    };
  }
}
