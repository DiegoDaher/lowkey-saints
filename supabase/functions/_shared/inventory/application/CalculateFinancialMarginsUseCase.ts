import { Prisma } from "../../generated/prisma/client.ts";
import type { ShopService } from "../../service.ts";
import { AppError } from "../../AppError.ts";
import type {
  FinancialDashboard,
  FinancialRow,
} from "../../financial-contracts.ts";
const D = Prisma.Decimal;
type Source = {
  id: string;
  name: string;
  version: number;
  isArchived: boolean;
  salePrice: Prisma.Decimal;
  financial: { costPrice: Prisma.Decimal } | null;
};
export function calculateFinancialRow(
  p: Source,
  threshold: Prisma.Decimal
): FinancialRow {
  const cost = p.financial?.costPrice ?? null;
  const amount = cost === null ? null : p.salePrice.minus(cost);
  const percent =
    amount === null || p.salePrice.isZero()
      ? null
      : amount.div(p.salePrice).mul(100);
  return {
    id: p.id,
    name: p.name,
    version: p.version,
    isArchived: p.isArchived,
    salePrice: p.salePrice.toFixed(2),
    costPrice: cost?.toFixed(2) ?? null,
    amount: amount?.toFixed(2) ?? null,
    percent: percent?.toFixed(2) ?? null,
    status:
      amount === null
        ? "missing"
        : amount.isNegative()
          ? "negative"
          : percent === null
            ? "undefined"
            : percent.lt(threshold)
              ? "low"
              : "healthy",
  };
}
export class CalculateFinancialMarginsUseCase {
  constructor(private shop: ShopService) {}
  async dashboard(query: {
    q: string;
    category: string;
    state: string;
    page: number;
  }): Promise<FinancialDashboard> {
    return this.shop.db.$transaction(
      async (tx) => {
        const settings = await tx.financialSettings.findUniqueOrThrow({
          where: { id: 1 },
        });
        const products = await tx.product.findMany({
          where: {
            ...(query.q
              ? { name: { contains: query.q, mode: "insensitive" as const } }
              : {}),
            ...(query.category
              ? { categories: { some: { categoryId: query.category } } }
              : {}),
            ...(query.state === "all"
              ? {}
              : { isArchived: query.state === "archived" }),
          },
          select: {
            id: true,
            name: true,
            version: true,
            isArchived: true,
            salePrice: true,
            financial: { select: { costPrice: true } },
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        });
        const rows = products.map((p) =>
          calculateFinancialRow(p, settings.lowMarginThreshold)
        );
        let sum = new D(0),
          eligible = 0;
        for (const p of products)
          if (p.financial && !p.salePrice.isZero()) {
            sum = sum.plus(
              p.salePrice.minus(p.financial.costPrice).div(p.salePrice).mul(100)
            );
            eligible++;
          }
        return {
          items: rows.slice((query.page - 1) * 50, query.page * 50),
          total: rows.length,
          settings: {
            lowMarginThreshold: settings.lowMarginThreshold.toFixed(2),
            version: settings.version,
          },
          kpis: {
            averageMargin: eligible ? sum.div(eligible).toFixed(2) : null,
            eligible,
            low: rows.filter((r) => r.status === "low").length,
            negative: rows.filter((r) => r.status === "negative").length,
            missing: rows.filter((r) => r.status === "missing").length,
          },
        };
      },
      { isolationLevel: "RepeatableRead" }
    );
  }
  async save(
    productId: string,
    input: { version?: number; salePrice?: string; costPrice: string }
  ) {
    return this.shop.atomic(async (tx) => {
      if (
        !(await tx.product.findUnique({
          where: { id: productId },
          select: { id: true },
        }))
      )
        throw new AppError(404, "Producto no encontrado");
      const changed = await tx.product.updateMany({
        where: {
          id: productId,
          ...(input.version === undefined ? {} : { version: input.version }),
        },
        data: {
          ...(input.salePrice === undefined
            ? {}
            : { salePrice: input.salePrice }),
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new AppError(
          409,
          "El producto cambió. Recarga antes de guardar."
        );
      const cost = await tx.productCost.upsert({
        where: { productId },
        create: { productId, costPrice: input.costPrice },
        update: { costPrice: input.costPrice },
      });
      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { financial: true },
      });
      const settings = await tx.financialSettings.findUniqueOrThrow({
        where: { id: 1 },
      });
      return {
        cost,
        row: calculateFinancialRow(product, settings.lowMarginThreshold),
      };
    });
  }
}
