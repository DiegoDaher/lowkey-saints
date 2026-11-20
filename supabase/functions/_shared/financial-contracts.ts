import { z } from "zod";
import { money, id } from "./contracts.ts";
export const financialPricesInput = z
  .object({
    version: z.number().int().nonnegative(),
    salePrice: money,
    costPrice: money,
  })
  .strict();
export const financialSettingsInput = z
  .object({
    version: z.number().int().nonnegative(),
    lowMarginThreshold: money.refine(
      (v) => Number(v) <= 100,
      "El umbral debe estar entre 0 y 100"
    ),
  })
  .strict();
export const financialQuery = z.object({
  q: z.string().trim().max(200).default(""),
  category: z.union([id, z.literal("")]).default(""),
  state: z.enum(["active", "archived", "all"]).default("active"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
});
export interface FinancialSettings {
  lowMarginThreshold: string;
  version: number;
}
export interface FinancialRow {
  id: string;
  name: string;
  version: number;
  isArchived: boolean;
  salePrice: string;
  costPrice: string | null;
  amount: string | null;
  percent: string | null;
  status: "missing" | "negative" | "undefined" | "low" | "healthy";
}
export interface FinancialDashboard {
  items: FinancialRow[];
  total: number;
  settings: FinancialSettings;
  kpis: {
    averageMargin: string | null;
    eligible: number;
    low: number;
    negative: number;
    missing: number;
  };
}
