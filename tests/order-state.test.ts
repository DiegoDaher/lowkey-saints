import assert from "node:assert/strict";
import test from "node:test";
import {
  availableOrderActions,
  orderStatuses,
  requireTransition,
} from "../supabase/functions/_shared/orders/domain/OrderStateValidator.ts";

const now = new Date("2026-11-11T12:00:00Z");
const later = new Date(now.getTime() + 1);
const permitted = new Set([
  "PENDING_PAYMENT:CONFIRMED",
  "PENDING_PAYMENT:CANCELLED",
  "CONFIRMED:SHIPPED",
]);
for (const from of orderStatuses)
  for (const to of orderStatuses) {
    test(`${from} -> ${to}`, () => {
      const validate = () => requireTransition(from, to, later, now);
      if (permitted.has(`${from}:${to}`)) assert.doesNotThrow(validate);
      else assert.throws(validate, { status: 409 });
    });
  }
test("confirmation uses strict server expiry boundary", () => {
  for (const offset of [-1, 0, 1]) {
    const expiry = new Date(now.getTime() + offset);
    const confirm = () =>
      requireTransition("PENDING_PAYMENT", "CONFIRMED", expiry, now);
    if (offset > 0) assert.doesNotThrow(confirm);
    else assert.throws(confirm, { status: 409 });
    assert.deepEqual(
      availableOrderActions("PENDING_PAYMENT", expiry, now),
      offset > 0 ? ["CONFIRMED", "CANCELLED"] : ["CANCELLED"]
    );
  }
  assert.deepEqual(availableOrderActions("CONFIRMED", now, now), ["SHIPPED"]);
  assert.deepEqual(availableOrderActions("SHIPPED", later, now), []);
  assert.deepEqual(availableOrderActions("CANCELLED", later, now), []);
});
test("unknown states including object property names are rejected", () => {
  for (const value of ["UNKNOWN", "", "toString", "__proto__"]) {
    assert.throws(() => requireTransition(value, "SHIPPED", later, now), {
      status: 409,
    });
    assert.throws(
      () => requireTransition("PENDING_PAYMENT", value, later, now),
      { status: 409 }
    );
  }
});
