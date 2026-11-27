import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IDEMPOTENCY_WINDOW_MS,
  backoffMs,
  classifyProviderError,
  isDeliveryUncertain,
  providerErrorMessage,
  retryEligibility,
} from "../supabase/functions/_shared/restock/domain/NotificationDeliveryPolicy";
import { unsubscribeHeaders } from "../supabase/functions/_shared/restock/application/DeliverRestockNotificationsUseCase";

const now = new Date("2026-11-26T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

test("backoff doubles and caps at one hour", () => {
  assert.equal(backoffMs(1), 2 * 60000);
  assert.equal(backoffMs(3), 8 * 60000);
  assert.equal(backoffMs(10), 60 * 60000);
});

test("only a started delivery outside the dedup window is uncertain", () => {
  const old = ago(IDEMPOTENCY_WINDOW_MS + 60000);
  assert.equal(
    isDeliveryUncertain({ attempts: 0, firstAttemptAt: null }, now),
    false
  );
  assert.equal(
    isDeliveryUncertain({ attempts: 0, firstAttemptAt: old }, now),
    false
  );
  assert.equal(
    isDeliveryUncertain({ attempts: 2, firstAttemptAt: ago(3600000) }, now),
    false
  );
  assert.equal(
    isDeliveryUncertain({ attempts: 1, firstAttemptAt: old }, now),
    true
  );
});

test("provider errors are permanent only for rejected requests", () => {
  for (const status of [400, 401, 403, 422])
    assert.equal(classifyProviderError(status), "permanent");
  for (const status of [null, 408, 409, 429, 500, 503])
    assert.equal(classifyProviderError(status), "transient");
  assert.match(providerErrorMessage(422), /rechazó.*422/);
  assert.match(providerErrorMessage(503), /HTTP 503/);
});

test("retry eligibility", () => {
  const failed = { status: "FAILED", attempts: 1, firstAttemptAt: ago(60000) };
  assert.equal(retryEligibility(failed, "ACTIVE", now), "ready");
  assert.equal(
    retryEligibility(
      { ...failed, firstAttemptAt: ago(IDEMPOTENCY_WINDOW_MS + 1) },
      "ACTIVE",
      now
    ),
    "needs-confirmation"
  );
  assert.equal(retryEligibility(failed, "UNSUBSCRIBED", now), null);
  assert.equal(
    retryEligibility({ ...failed, status: "SENT" }, "ACTIVE", now),
    null
  );
});

test("one-click unsubscribe headers need an HTTPS endpoint", () => {
  assert.deepEqual(
    unsubscribeHeaders(
      {
        siteUrl: "https://shop.mx",
        apiUrl: "https://x.supabase.co/functions/v1/api/",
      },
      "tok"
    ),
    {
      "List-Unsubscribe":
        "<https://x.supabase.co/functions/v1/api/v1/unsubscribe/one-click?token=tok>, <https://shop.mx/baja?token=tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
  );
  assert.deepEqual(
    unsubscribeHeaders(
      { siteUrl: "https://shop.mx", apiUrl: "http://kong:8000" },
      "tok"
    ),
    { "List-Unsubscribe": "<https://shop.mx/baja?token=tok>" }
  );
});
