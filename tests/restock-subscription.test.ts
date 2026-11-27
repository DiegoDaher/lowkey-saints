import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSubscription } from "../supabase/functions/_shared/restock/domain/RestockSubscriptionPolicy";

test("new email creates one subscription", () => {
  assert.deepEqual(decideSubscription(null, false), {
    action: "create",
    result: "created",
  });
  assert.deepEqual(decideSubscription(null, true), {
    action: "create",
    result: "created",
  });
});

test("active subscription is idempotent", () => {
  for (const reactivate of [false, true])
    assert.deepEqual(decideSubscription({ status: "ACTIVE" }, reactivate), {
      action: "none",
      result: "active",
    });
});

test("notified subscription reactivates without asking", () => {
  for (const reactivate of [false, true])
    assert.deepEqual(decideSubscription({ status: "NOTIFIED" }, reactivate), {
      action: "reactivate",
      result: "reactivated",
    });
});

test("unsubscribed email needs explicit consent", () => {
  assert.deepEqual(decideSubscription({ status: "UNSUBSCRIBED" }, false), {
    action: "none",
    result: "unsubscribed",
  });
  assert.deepEqual(decideSubscription({ status: "UNSUBSCRIBED" }, true), {
    action: "reactivate",
    result: "reactivated",
  });
});
