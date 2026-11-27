import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOLD_MS,
  addLine,
  emptyCart,
  holdRemaining,
  isHoldExpired,
  itemCount,
  migrateLegacy,
  parseCartState,
  removeLine,
  setQuantity,
  subtotalCents,
  toCents,
  type CartLine,
} from "../src/modules/orders/domain/cart";

const line = (over: Partial<CartLine> = {}): Omit<CartLine, "quantity"> => ({
  variantId: "v1",
  slug: "hoodie",
  name: "Hoodie",
  size: "M",
  color: "Negro",
  priceCents: 10025,
  maxQuantity: 3,
  ...over,
});

test("toCents parses decimal strings without float math", () => {
  assert.equal(toCents("100.25"), 10025);
  assert.equal(toCents("0.1"), 10);
  assert.equal(toCents("19"), 1900);
  assert.equal(toCents("1999.9"), 199990);
  assert.equal(toCents("1.005"), 100);
  assert.equal(toCents("abc"), 0);
});

test("subtotal is exact in cents", () => {
  let s = addLine(
    emptyCart,
    line({ variantId: "a", priceCents: toCents("0.1") }),
    1
  );
  s = addLine(s, line({ variantId: "b", priceCents: toCents("0.2") }), 1);
  assert.equal(subtotalCents(s.items), 30);
  assert.equal(itemCount(s.items), 2);
});

test("addLine merges, clamps to stock and refreshes hold", () => {
  let s = addLine(emptyCart, line(), 10);
  s = addLine(s, line(), 20);
  s = addLine(s, line(), 30);
  s = addLine(s, line(), 40);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].quantity, 3);
  assert.equal(s.heldAt, 40);
  assert.equal(addLine(emptyCart, line({ maxQuantity: 0 }), 1), emptyCart);
  const big = addLine(emptyCart, line({ maxQuantity: 99 }), 1, 50);
  assert.equal(big.items[0].quantity, 20);
});

test("setQuantity clamps and removeLine clears hold when empty", () => {
  let s = addLine(emptyCart, line(), 5);
  s = setQuantity(s, "v1", 10);
  assert.equal(s.items[0].quantity, 3);
  s = setQuantity(s, "v1", 2);
  assert.equal(s.items[0].quantity, 2);
  assert.equal(s.heldAt, 5);
  s = removeLine(s, "v1");
  assert.deepEqual(s, { items: [], heldAt: null });
});

test("hold expires after 60 minutes", () => {
  assert.equal(holdRemaining(0, HOLD_MS - 1000), 1000);
  assert.equal(isHoldExpired(0, HOLD_MS - 1), false);
  assert.equal(isHoldExpired(0, HOLD_MS), true);
  assert.equal(isHoldExpired(null, HOLD_MS), false);
});

test("parseCartState rejects invalid lines and bad JSON", () => {
  const good = { ...line(), quantity: 1 };
  const raw = JSON.stringify({
    items: [good, { ...good, variantId: "x", quantity: 5 }, { foo: 1 }],
    heldAt: 7,
  });
  assert.deepEqual(parseCartState(raw), { items: [good], heldAt: 7 });
  assert.deepEqual(parseCartState("{"), emptyCart);
  assert.deepEqual(parseCartState(null), emptyCart);
});

test("migrateLegacy converts lowkey-cart lines to cents", () => {
  const legacy = JSON.stringify([
    {
      variantId: "v",
      name: "Camiseta",
      size: "M",
      color: "Negro",
      price: "100.25",
      quantity: 2,
    },
    { variantId: "bad", name: "x", price: 5, quantity: 1 },
  ]);
  const s = migrateLegacy(legacy, 99);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].priceCents, 10025);
  assert.equal(s.items[0].quantity, 2);
  assert.equal(s.heldAt, 99);
  assert.deepEqual(parseCartState(JSON.stringify(s)), s);
});
