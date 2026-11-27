import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRestockResult,
  restockConfirmation,
  restockErrorMessage,
  restockNeedsReload,
  validateRestockEmail,
} from "../src/modules/restock/domain/restock-form";
import { ApiError } from "../src/lib/api";

test("validateRestockEmail trims and lowercases like the API contract", () => {
  assert.deepEqual(validateRestockEmail("  User@EXAMPLE.com "), {
    ok: true,
    email: "user@example.com",
  });
});

test("validateRestockEmail rejects empty, malformed and too long emails", () => {
  assert.deepEqual(validateRestockEmail(""), {
    ok: false,
    error: "Escribe tu correo.",
  });
  assert.equal(validateRestockEmail(null).ok, false);
  assert.equal(validateRestockEmail("sin-arroba").ok, false);
  assert.equal(validateRestockEmail("a@b").ok, false);
  const long = "a".repeat(250) + "@x.com";
  assert.deepEqual(validateRestockEmail(long), {
    ok: false,
    error: "El correo es demasiado largo.",
  });
});

test("restockErrorMessage maps API statuses to Spanish copy", () => {
  assert.match(restockErrorMessage(new ApiError(409, "x")), /ya tiene piezas/);
  assert.match(
    restockErrorMessage(new ApiError(404, "x")),
    /ya no está disponible/
  );
  assert.match(restockErrorMessage(new ApiError(429, "x")), /Espera un minuto/);
  assert.match(restockErrorMessage(new ApiError(400, "x")), /Revisa tu correo/);
  assert.equal(
    restockErrorMessage(new ApiError(500, "Servidor caído")),
    "Servidor caído"
  );
  assert.equal(
    restockErrorMessage("??"),
    "No pudimos registrar tu aviso. Intenta de nuevo."
  );
});

test("restockNeedsReload only for stale variant answers", () => {
  assert.equal(restockNeedsReload(new ApiError(404, "x")), true);
  assert.equal(restockNeedsReload(new ApiError(409, "x")), true);
  assert.equal(restockNeedsReload(new ApiError(429, "x")), false);
  assert.equal(restockNeedsReload(new Error("x")), false);
});

test("parseRestockResult reads the LOG-05 outcome and tolerates the old API", () => {
  assert.equal(parseRestockResult({ result: "active" }), "active");
  assert.equal(parseRestockResult({ result: "unsubscribed" }), "unsubscribed");
  assert.equal(parseRestockResult({ result: "reactivated" }), "reactivated");
  assert.equal(parseRestockResult({ ok: true }), "created");
  assert.equal(parseRestockResult({ result: "weird" }), "created");
  assert.equal(parseRestockResult(null), "created");
});

test("restockConfirmation tells the shopper what happened", () => {
  const created = restockConfirmation("created", "a@b.co", "talla M en negro");
  assert.equal(created.title, "Listo, te avisaremos.");
  assert.match(created.body, /a@b\.co cuando talla M en negro vuelva/);
  assert.equal(
    restockConfirmation("active", "a@b.co").title,
    "Ya estabas en la lista."
  );
  assert.equal(
    restockConfirmation("reactivated", "a@b.co").title,
    "Avisos reactivados."
  );
  assert.match(restockConfirmation("active", "a@b.co").body, /esta variante/);
});
