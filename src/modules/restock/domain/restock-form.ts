import { subscriptionInput } from "../../../../supabase/functions/_shared/contracts";

/** Same rule the API applies in POST /v1/restock, so client and server agree. */
export const restockEmailSchema = subscriptionInput.pick({ email: true });

export const RESTOCK_EMAIL_KEY = "restock-email";

export type RestockEmailResult =
  { ok: true; email: string } | { ok: false; error: string };

export function validateRestockEmail(raw: unknown): RestockEmailResult {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, error: "Escribe tu correo." };
  const parsed = restockEmailSchema.safeParse({ email: value });
  if (!parsed.success)
    return {
      ok: false,
      error:
        value.length > 254
          ? "El correo es demasiado largo."
          : "Ingresa un correo válido, por ejemplo nombre@correo.com.",
    };
  return { ok: true, email: parsed.data.email };
}

export function restockErrorMessage(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status: unknown }).status
      : undefined;
  if (status === 409)
    return "Esta variante ya tiene piezas disponibles. Recarga la página para comprarla.";
  if (status === 429)
    return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  if (status === 400) return "Revisa tu correo e intenta de nuevo.";
  const message = error instanceof Error ? error.message : "";
  return message || "No pudimos registrar tu aviso. Intenta de nuevo.";
}

export function loadRememberedEmail(): string {
  try {
    return localStorage.getItem(RESTOCK_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberEmail(email: string) {
  try {
    localStorage.setItem(RESTOCK_EMAIL_KEY, email);
  } catch {
    // Private mode or blocked storage: remembering is only a convenience.
  }
}
