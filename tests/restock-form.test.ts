import { test } from "node:test";
import assert from "node:assert/strict";
import {
  restockErrorMessage,
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
