import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogQuery } from "../supabase/functions/_shared/contracts";
import { GetCatalogFilteredUseCase } from "../supabase/functions/_shared/catalog/application/GetCatalogFilteredUseCase";
import { catalogCardSelect } from "../supabase/functions/_shared/catalog/infra/PrismaCatalogRepository";

test("catalogQuery validates and normalizes filters", () => {
  assert.throws(() => catalogQuery.parse({ min: "50", max: "10" }));
  assert.throws(() => catalogQuery.parse({ q: "x".repeat(101) }));
  assert.throws(() => catalogQuery.parse({ sort: "random" }));
  assert.throws(() => catalogQuery.parse({ size: Array(11).fill("M") }));
  assert.throws(() => catalogQuery.parse({ page: "0" }));
  const ok = catalogQuery.parse({ sort: "relevancia", category: "", min: "" });
  assert.equal(ok.sort, "recientes");
  assert.equal(ok.category, undefined);
  assert.equal(ok.min, undefined);
  assert.equal(ok.page, 1);
});

test("use case always excludes archived products and combines filters", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let received: any;
  const useCase = new GetCatalogFilteredUseCase({
    async findPage(query) {
      received = query;
      return { items: [{ id: "a" }], total: 49 };
    },
  });
  const filters = catalogQuery.parse({
    page: "2",
    category: "tops",
    min: "10",
    max: "99.50",
    size: ["M"],
    color: ["Negro"],
    sort: "precio-desc",
  });
  const page = await useCase.execute(filters);
  assert.equal(received.where.isArchived, false);
  assert.deepEqual(received.where.salePrice, { gte: "10", lte: "99.50" });
  assert.deepEqual(received.where.variants.some, {
    isArchived: false,
    size: { in: ["M"] },
    color: { in: ["Negro"] },
  });
  assert.ok(received.where.categories.some);
  assert.deepEqual(received.orderBy, [{ salePrice: "desc" }, { id: "asc" }]);
  assert.equal(received.skip, 24);
  assert.equal(received.take, 24);
  assert.deepEqual(
    { total: page.total, page: page.page, pages: page.pages },
    { total: 49, page: 2, pages: 3 }
  );
});

test("card projection leaves out heavy and internal fields", () => {
  const keys = Object.keys(catalogCardSelect);
  for (const k of ["materials", "specifications", "measurements", "version"])
    assert.ok(!keys.includes(k));
  assert.equal(catalogCardSelect.images.take, 2);
  assert.ok(!("sku" in catalogCardSelect.variants.select));
});
