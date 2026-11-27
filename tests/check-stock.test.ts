import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStock } from "../src/modules/inventory/application/CheckStockUseCase";

test("checkStock classifies stock levels", () => {
  assert.equal(checkStock({ stock: 0 }).status, "out");
  assert.equal(checkStock({ stock: 0 }).canPurchase, false);
  assert.equal(checkStock({ stock: 1 }).label, "Última pieza");
  assert.equal(checkStock({ stock: 2 }).label, "Últimas 2 piezas");
  assert.equal(checkStock({ stock: 3 }).status, "in_stock");
  assert.equal(checkStock({ stock: 3 }).label, null);
});

test("checkStock treats missing, archived, negative and over-requested as out", () => {
  assert.equal(checkStock(undefined).status, "out");
  assert.equal(checkStock({ stock: 5, isArchived: true }).status, "out");
  assert.equal(checkStock({ stock: -2 }).available, 0);
  assert.equal(checkStock({ stock: 2 }, 3).canPurchase, false);
  assert.equal(checkStock({ stock: 2 }, 3).reason, "out_of_stock");
});

test("checkStock rejects non-finite and fractional stock safely", () => {
  assert.equal(checkStock({ stock: Number.NaN }).status, "out");
  assert.equal(checkStock({ stock: Infinity }).status, "out");
  assert.equal(checkStock({ stock: 2.9 }).available, 2);
});

test("checkStock limits purchases by what is already in the cart", () => {
  const inBag = checkStock({ stock: 2 }, 1, 1);
  assert.equal(inBag.canPurchase, true);
  assert.equal(inBag.reason, "ok");
  const full = checkStock({ stock: 2 }, 1, 2);
  assert.equal(full.canPurchase, false);
  assert.equal(full.reason, "limit_in_cart");
  assert.equal(full.status, "limit");
  assert.equal(checkStock({ stock: 0 }, 1, 1).reason, "out_of_stock");
});
