import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStockDraft } from "../src/modules/inventory/domain/stock-draft";
import {
  stockInput,
  variantUpdateInput,
  archiveInput,
} from "../supabase/functions/_shared/contracts";

test("stock drafts reject empty, fractional and out-of-range cells without coercing blanks to zero", () => {
  for (const value of ["", " ", "-1", "1.5", "100001", "NaN", "1e2"]) {
    assert.throws(() => parseStockDraft({ a: { id: "a", version: 3, value } }));
  }
  assert.deepEqual(
    parseStockDraft({
      a: { id: "a", version: 3, value: "0" },
      b: { id: "b", version: 5, value: "100000" },
    }),
    [
      { id: "a", version: 3, stock: 0 },
      { id: "b", version: 5, stock: 100000 },
    ]
  );
  assert.throws(() => parseStockDraft({}));
  assert.throws(() =>
    parseStockDraft(
      Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [
          String(i),
          { id: String(i), version: 0, value: "1" },
        ])
      )
    )
  );
});
test("bulk contract rejects duplicates and supports 100 distinct variants", () => {
  const changes = Array.from({ length: 100 }, () => ({
    id: crypto.randomUUID(),
    version: 0,
    stock: 1,
  }));
  assert.equal(stockInput.safeParse({ changes }).success, true);
  assert.equal(
    stockInput.safeParse({ changes: [...changes, changes[0]] }).success,
    false
  );
  assert.equal(
    stockInput.safeParse({ changes: [changes[0], changes[0]] }).success,
    false
  );
});
test("variant and archive writes require versions and cannot change stock or product ownership", () => {
  assert.equal(archiveInput.safeParse({ isArchived: true }).success, false);
  assert.equal(
    variantUpdateInput.safeParse({ version: 0, size: "L", isArchived: false })
      .success,
    true
  );
  assert.equal(
    variantUpdateInput.safeParse({ version: 0, stock: 1 }).success,
    false
  );
  assert.equal(
    variantUpdateInput.safeParse({ version: 0, productId: crypto.randomUUID() })
      .success,
    false
  );
});
