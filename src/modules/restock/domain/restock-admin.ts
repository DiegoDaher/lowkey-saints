import type { NotificationStatus } from "../../../../supabase/functions/_shared/contracts";

/** Pure helpers for the Backoffice restock workspace (LOG-06). */
export type RestockFilters = {
  q: string;
  status: string;
  delivery: string;
  page: number;
};
export const emptyRestockFilters: RestockFilters = {
  q: "",
  status: "",
  delivery: "",
  page: 1,
};
export type RetryEligibility = "ready" | "needs-confirmation" | null;
export type AdminNotice = {
  id?: string;
  generation?: number;
  status: string;
  attempts: number;
  lastError: string | null;
  availableAt?: string;
  sentAt?: string | null;
  firstAttemptAt?: string | null;
  createdAt?: string;
  retry?: RetryEligibility;
};
export type AdminSubscription = {
  id: string;
  email: string;
  status: string;
  createdAt?: string;
  variant: {
    size: string;
    color: string;
    stock?: number;
    product: { name: string };
  };
  notifications: AdminNotice[];
};
export type RestockListing = {
  items: AdminSubscription[];
  total: number | null;
  page: number;
  pages: number | null;
  counts: Partial<Record<NotificationStatus, number>>;
};
export const PAGE_SIZE = 50;

export function hasRestockFilters(f: RestockFilters) {
  return !!(f.q.trim() || f.status || f.delivery);
}

export function restockQuery(f: RestockFilters) {
  const params = new URLSearchParams({ page: String(f.page) });
  if (f.status) params.set("status", f.status);
  if (f.delivery) params.set("delivery", f.delivery);
  if (f.q.trim()) params.set("q", f.q.trim().slice(0, 100));
  return "/admin/restock?" + params.toString();
}

/** Accepts the LOG-06 shape and the older bare array, so deploy order doesn't matter. */
export function normalizeRestockListing(
  raw: unknown,
  page: number
): RestockListing {
  if (Array.isArray(raw))
    return { items: raw, total: null, page, pages: null, counts: {} };
  const value = (raw ?? {}) as Partial<RestockListing>;
  return {
    items: Array.isArray(value.items) ? value.items : [],
    total: typeof value.total === "number" ? value.total : null,
    page: typeof value.page === "number" ? value.page : page,
    pages: typeof value.pages === "number" ? value.pages : null,
    counts: value.counts ?? {},
  };
}

export function hasNextPage(listing: RestockListing) {
  return listing.pages === null
    ? listing.items.length >= PAGE_SIZE
    : listing.page < listing.pages;
}

const dateTime = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
const time = (value: string) =>
  new Date(value).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });
export const formatRestockDate = (value: string) =>
  new Date(value).toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
  });

export type NoticeTone = "waiting" | "queued" | "sent" | "failed" | "muted";
export type NoticeView = { label: string; tone: NoticeTone; detail: string };

/** Plain-language state of one notification for the table. */
export function describeNotice(
  n: AdminNotice,
  stock: number | undefined,
  now: Date
): NoticeView {
  const tries =
    n.attempts > 0
      ? n.attempts + (n.attempts === 1 ? " intento" : " intentos")
      : "";
  const withTries = (text: string) => [text, tries].filter(Boolean).join(" · ");
  switch (n.status) {
    case "PENDING":
      if (stock === 0)
        return {
          label: "Esperando stock",
          tone: "waiting",
          detail: withTries("Se enviará cuando vuelva el inventario"),
        };
      return {
        label: "En cola",
        tone: "queued",
        detail: withTries(
          n.availableAt && new Date(n.availableAt) > now
            ? "Próximo intento " + time(n.availableAt)
            : "Se enviará en el próximo minuto"
        ),
      };
    case "PROCESSING":
      return { label: "Enviando", tone: "queued", detail: withTries("") };
    case "SENT":
      return {
        label: "Enviado",
        tone: "sent",
        detail: n.sentAt ? "El " + dateTime(n.sentAt) : "",
      };
    case "FAILED":
      return {
        label: "Requiere revisión",
        tone: "failed",
        detail: withTries(n.lastError ?? ""),
      };
    case "CANCELLED":
      return {
        label: "Cancelado",
        tone: "muted",
        detail: "Variante archivada o baja del cliente",
      };
    default:
      return { label: n.status, tone: "muted", detail: withTries("") };
  }
}

/** Confirmation text before a retry; null when no confirmation is needed. */
export function retryConfirmation(n: AdminNotice): string | null {
  return n.retry === "needs-confirmation"
    ? "El primer envío fue hace más de 23 horas y no se puede confirmar si llegó. Si reintentas, el cliente podría recibir el correo dos veces. ¿Reintentar de todos modos?"
    : null;
}

export function bulkRetryConfirmation(failed: number) {
  return (
    "¿Volver a poner en cola los avisos que requieren revisión? " +
    (failed === 1 ? "Hay 1 aviso" : "Hay " + failed + " avisos") +
    " en ese estado; los de más de 23 horas se omiten para no duplicar correos."
  );
}

export function bulkRetryNotice(count: number) {
  if (count === 0)
    return "No había avisos seguros para reintentar; revisa los que necesitan confirmación uno por uno.";
  return count === 1
    ? "1 aviso vuelve a la cola."
    : count + " avisos vuelven a la cola.";
}
