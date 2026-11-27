import {
  restockResults,
  subscriptionInput,
  type RestockResult,
} from "../../../../supabase/functions/_shared/contracts";

export type { RestockResult };

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
  if (status === 404)
    return "Esta talla o color ya no está disponible. Recarga la página para ver las opciones actuales.";
  if (status === 409)
    return "Esta variante ya tiene piezas disponibles. Recarga la página para comprarla.";
  if (status === 429)
    return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  if (status === 400) return "Revisa tu correo e intenta de nuevo.";
  const message = error instanceof Error ? error.message : "";
  return message || "No pudimos registrar tu aviso. Intenta de nuevo.";
}

/** Statuses where reloading the page is the useful next step. */
export function restockNeedsReload(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status: unknown }).status
      : undefined;
  return status === 404 || status === 409;
}

/**
 * Reads the API outcome. Older deployments answer `{ ok: true }`, which
 * always meant "subscribed", so the form keeps working in any deploy order.
 */
export function parseRestockResult(value: unknown): RestockResult {
  const result =
    typeof value === "object" && value !== null && "result" in value
      ? (value as { result: unknown }).result
      : undefined;
  return restockResults.find((r) => r === result) ?? "created";
}

export function restockConfirmation(
  result: Exclude<RestockResult, "unsubscribed">,
  email: string,
  variantLabel?: string
): { title: string; body: string } {
  const what = variantLabel ? variantLabel : "esta variante";
  return {
    title:
      result === "active"
        ? "Ya estabas en la lista."
        : result === "reactivated"
          ? "Avisos reactivados."
          : "Listo, te avisaremos.",
    body: `Enviaremos un correo a ${email} cuando ${what} vuelva a estar disponible.`,
  };
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
