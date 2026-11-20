import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../supabase/functions/_shared/generated/prisma/client.ts";
import { calculateFinancialRow } from "../supabase/functions/_shared/inventory/application/CalculateFinancialMarginsUseCase.ts";
import {
  financialPricesInput,
  financialSettingsInput,
} from "../supabase/functions/_shared/financial-contracts.ts";
import {
  adminPermission,
  hasPermission,
} from "../supabase/functions/_shared/admin-access.ts";
const D = Prisma.Decimal;
function row(sale: string, cost: string | null, threshold = "30") {
  return calculateFinancialRow(
    {
      id: "test",
      name: "test",
      version: 0,
      isArchived: false,
      salePrice: new D(sale),
      financial: cost === null ? null : { costPrice: new D(cost) },
    },
    new D(threshold)
  );
}
test("decimal financial calculation and threshold boundaries", () => {
  assert.equal(row("0.30", "0.20").amount, "0.10");
  assert.equal(row("0.30", "0.20").percent, "33.33");
  assert.equal(row("100", "70").status, "healthy");
  assert.equal(row("100", "70.01").status, "low");
  assert.equal(row("100000", "70000.01").percent, "30.00");
  assert.equal(row("100000", "70000.01").status, "low");
  assert.equal(row("100", "100").status, "low");
  assert.equal(row("100", "100", "0").status, "healthy");
  assert.equal(row("100", "101").status, "negative");
});
test("missing costs and zero sale prices are distinct", () => {
  assert.equal(row("100", null).amount, null);
  assert.equal(row("100", null).status, "missing");
  assert.equal(row("100", "0").percent, "100.00");
  assert.equal(row("0", "0").percent, null);
  assert.equal(row("0", "0").status, "undefined");
  assert.equal(row("0", "5").status, "negative");
  assert.equal(row("0", "5").amount, "-5.00");
});
test("financial contracts reject invalid money and require versions", () => {
  for (const costPrice of ["", "-1", "1.001", "100000000", "NaN"])
    assert.equal(
      financialPricesInput.safeParse({
        version: 0,
        salePrice: "100",
        costPrice,
      }).success,
      false
    );
  assert.equal(
    financialPricesInput.safeParse({ salePrice: "100", costPrice: "1" })
      .success,
    false
  );
  for (const lowMarginThreshold of ["-1", "100.01", "30.001"])
    assert.equal(
      financialSettingsInput.safeParse({ version: 0, lowMarginThreshold })
        .success,
      false
    );
});
test("only ADMIN has all new financial permissions", () => {
  for (const [path, method] of [
    ["dashboard", "GET"],
    ["settings", "GET"],
    ["settings", "PUT"],
    ["products/id", "PATCH"],
  ]) {
    const permission = adminPermission("/v1/admin/finances/" + path, method);
    assert.equal(permission, "finances");
    assert.equal(hasPermission("OPERATOR", permission!), false);
    assert.equal(hasPermission("ADMIN", permission!), true);
  }
  assert.equal(adminPermission("/v1/admin/finances/settings", "DELETE"), null);
});

test("dashboard averages all eligible products before pagination and handles empty sets", async () => {
  const { CalculateFinancialMarginsUseCase } =
    await import("../supabase/functions/_shared/inventory/application/CalculateFinancialMarginsUseCase.ts");
  const products = [
    {
      id: "1",
      name: "Positive",
      version: 0,
      isArchived: false,
      salePrice: new D(100),
      financial: { costPrice: new D(80) },
    },
    {
      id: "2",
      name: "Loss",
      version: 0,
      isArchived: false,
      salePrice: new D(100),
      financial: { costPrice: new D(120) },
    },
    {
      id: "3",
      name: "Zero sale",
      version: 0,
      isArchived: false,
      salePrice: new D(0),
      financial: { costPrice: new D(5) },
    },
    {
      id: "4",
      name: "Missing",
      version: 0,
      isArchived: false,
      salePrice: new D(100),
      financial: null,
    },
  ];
  const tx = {
    financialSettings: {
      findUniqueOrThrow: async () => ({
        lowMarginThreshold: new D(30),
        version: 0,
      }),
    },
    product: { findMany: async () => products },
  };
  const shop = {
    db: {
      $transaction: async (work: (client: typeof tx) => unknown) => work(tx),
    },
  };
  const useCase = new CalculateFinancialMarginsUseCase(
    shop as unknown as ConstructorParameters<
      typeof CalculateFinancialMarginsUseCase
    >[0]
  );
  const report = await useCase.dashboard({
    q: "",
    category: "",
    state: "active",
    page: 2,
  });
  assert.equal(report.total, 4);
  assert.deepEqual(report.items, []);
  assert.deepEqual(report.kpis, {
    averageMargin: "0.00",
    eligible: 2,
    low: 1,
    negative: 2,
    missing: 1,
  });
  products.length = 0;
  assert.equal(
    (await useCase.dashboard({ q: "", category: "", state: "active", page: 1 }))
      .kpis.averageMargin,
    null
  );
});
