export const catalogSorts = ["recientes", "precio-asc", "precio-desc"] as const;
export type CatalogSort = (typeof catalogSorts)[number];

export interface CatalogFilters {
  page: number;
  category?: string;
  q?: string;
  min?: string;
  max?: string;
  sizes: string[];
  colors: string[];
  sort: CatalogSort;
}

export interface CatalogPage<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface ICatalogRepository<T> {
  findPage(query: {
    where: unknown;
    orderBy: unknown;
    skip: number;
    take: number;
  }): Promise<{ items: T[]; total: number }>;
}
