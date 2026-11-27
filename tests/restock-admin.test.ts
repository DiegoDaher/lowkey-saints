import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bulkRetryNotice,
  describeNotice,
  emptyRestockFilters,
  hasNextPage,
  hasRestockFilters,
  normalizeRestockListing,
  restockQuery,
  retryConfirmation,
} from "../src/modules/restock/domain/restock-admin";

const now = new Date("2026-11-26T18:00:00Z");
const notice = { status: "PENDING", attempts: 0, lastError: null };

test("query keeps only active filters", () => {
  assert.equal(restockQuery(emptyRestockFilters), "/admin/restock?page=1");
  assert.equal(
    restockQuery({
      q: "  Ana@x.mx ",
      status: "ACTIVE",
      delivery: "FAILED",
      page: 2,
    }),
    "/admin/restock?page=2&status=ACTIVE&delivery=FAILED&q=Ana%40x.mx"
  );
  assert.equal(hasRestockFilters(emptyRestockFilters), false);
  assert.equal(hasRestockFilters({ ...emptyRestockFilters, q: " " }), false);
  assert.equal(
    hasRestockFilters({ ...emptyRestockFilters, delivery: "SENT" }),
    true
  );
});

test("listing accepts the new shape and the legacy array", () => {
  const legacy = normalizeRestockListing([], 3);
  assert.deepEqual(legacy, {
    items: [],
    total: null,
    page: 3,
    pages: null,
    counts: {},
  });
  assert.equal(hasNextPage(legacy), false);
  const current = normalizeRestockListing(
    { items: [], total: 120, page: 1, pages: 3, counts: { FAILED: 2 } },
    1
  );
  assert.equal(current.total, 120);
  assert.equal(hasNextPage(current), true);
  assert.equal(hasNextPage({ ...current, page: 3 }), false);
});

test("notices are described in plain language", () => {
  assert.equal(describeNotice(notice, 0, now).label, "Esperando stock");
  assert.equal(describeNotice(notice, 2, now).label, "En cola");
  assert.match(
    describeNotice(
      { ...notice, attempts: 2, availableAt: "2026-11-26T18:30:00Z" },
      2,
      now
    ).detail,
    /Próximo intento .* · 2 intentos/
  );
  const failed = describeNotice(
    {
      status: "FAILED",
      attempts: 1,
      lastError: "Resend rechazó el correo (HTTP 422)",
    },
    2,
    now
  );
  assert.equal(failed.tone, "failed");
  assert.equal(
    failed.detail,
    "Resend rechazó el correo (HTTP 422) · 1 intento"
  );
  assert.match(
    describeNotice(
      { ...notice, status: "SENT", sentAt: "2026-11-26T17:00:00Z" },
      2,
      now
    ).detail,
    /^El /
  );
});

test("retry confirmation only for uncertain deliveries", () => {
  assert.equal(
    retryConfirmation({ ...notice, status: "FAILED", retry: "ready" }),
    null
  );
  assert.match(
    retryConfirmation({
      ...notice,
      status: "FAILED",
      retry: "needs-confirmation",
    })!,
    /dos veces/
  );
  assert.equal(bulkRetryNotice(1), "1 aviso vuelve a la cola.");
  assert.equal(bulkRetryNotice(3), "3 avisos vuelven a la cola.");
  assert.match(bulkRetryNotice(0), /uno por uno/);
});
