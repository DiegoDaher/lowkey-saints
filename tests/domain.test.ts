import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeItems,
  requireTransition,
  margin,
} from "../supabase/functions/_shared/domain.ts";
import {
  orderInput,
  productInput,
  subscriptionInput,
} from "../supabase/functions/_shared/contracts.ts";
test("normalizes duplicate variants before reserving", () => {
  assert.deepEqual(
    mergeItems([
      { variantId: "b", quantity: 1 },
      { variantId: "a", quantity: 2 },
      { variantId: "b", quantity: 3 },
    ]),
    [
      { variantId: "a", quantity: 2 },
      { variantId: "b", quantity: 4 },
    ]
  );
  assert.throws(() => mergeItems([{ variantId: "a", quantity: 21 }]));
});
test("state machine rejects late payment, reopening and paid cancellation", () => {
  const now = new Date();
  const later = new Date(now.getTime() + 1000);
  requireTransition("PENDING_PAYMENT", "CONFIRMED", later, now);
  requireTransition("PENDING_PAYMENT", "CANCELLED", later, now);
  requireTransition("CONFIRMED", "SHIPPED", later, now);
  for (const [a, b] of [
    ["CONFIRMED", "CANCELLED"],
    ["CANCELLED", "CONFIRMED"],
    ["SHIPPED", "CANCELLED"],
  ])
    assert.throws(() => requireTransition(a, b, later, now));
  assert.throws(() =>
    requireTransition("PENDING_PAYMENT", "CONFIRMED", now, now)
  );
});
test("validates quantities and rejects client-controlled price", () => {
  const value = {
    idempotencyKey: crypto.randomUUID(),
    clientName: "Cliente",
    clientPhone: "5555555555",
    items: [{ variantId: crypto.randomUUID(), quantity: 1 }],
  };
  assert.equal(orderInput.safeParse(value).success, true);
  assert.equal(
    orderInput.safeParse({ ...value, totalAmount: 1 }).success,
    false
  );
  assert.equal(
    orderInput.safeParse({
      ...value,
      items: [{ ...value.items[0], quantity: -1 }],
    }).success,
    false
  );
});
test("normalizes restock emails and bounds look relations", () => {
  assert.equal(
    subscriptionInput.parse({
      email: "User@EXAMPLE.COM",
      variantId: crypto.randomUUID(),
    }).email,
    "user@example.com"
  );
  assert.equal(productInput.safeParse({}).success, false);
});
test("zero price does not divide by zero", () => {
  assert.deepEqual(margin(0, 20), { amount: -20, percent: null });
  assert.deepEqual(margin(100, 60), { amount: 40, percent: 40 });
});
