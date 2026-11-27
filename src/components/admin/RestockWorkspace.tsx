"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { notificationLabel, statusLabel } from "@/lib/status-label";
import {
  bulkRetryConfirmation,
  bulkRetryNotice,
  describeNotice,
  emptyRestockFilters,
  formatRestockDate,
  hasNextPage,
  hasRestockFilters,
  normalizeRestockListing,
  restockQuery,
  retryConfirmation,
  type AdminNotice,
  type NoticeTone,
  type RestockFilters,
  type RestockListing,
} from "@/modules/restock/domain/restock-admin";
import AdminButton from "./AdminButton";
import { AdminHeading, AdminLoading } from "./AdminFeedback";

const subscriptionColors: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-950",
  NOTIFIED: "bg-green-100 text-green-950",
  UNSUBSCRIBED: "bg-stone-200 text-stone-800",
};
const toneColors: Record<NoticeTone, string> = {
  waiting: "bg-amber-100 text-amber-950",
  queued: "bg-blue-100 text-blue-950",
  sent: "bg-green-100 text-green-950",
  failed: "bg-red-100 text-red-950",
  muted: "bg-stone-200 text-stone-800",
};
/** Chips in triage order: what needs attention first. */
const chips = ["FAILED", "PENDING", "SENT", "CANCELLED"] as const;
const chipLabels: Record<(typeof chips)[number], string> = {
  FAILED: "Requieren revisión",
  PENDING: "En cola",
  SENT: "Enviados",
  CANCELLED: "Cancelados",
};
const emptyListing: RestockListing = {
  items: [],
  total: null,
  page: 1,
  pages: null,
  counts: {},
};

async function call<T>(path: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabaseBrowser().auth.getSession();
  try {
    if (!session) throw new ApiError(401, "Inicia sesión de nuevo");
    return await api<T>(path, options, session.access_token);
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      window.location.replace(
        error.status === 401 ? "/401" : "/140210/sin-acceso"
      );
    throw error;
  }
}

export default function RestockWorkspace() {
  const [filters, setFilters] = useState<RestockFilters>(emptyRestockFilters);
  const [listing, setListing] = useState<RestockListing>(emptyListing);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const pending = useRef(new Set<string>());
  // Reference time for "next attempt" labels, refreshed with each load.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const raw = await call<unknown>(restockQuery(filters), {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setListing(normalizeRestockListing(raw, filters.page));
          setNow(new Date());
          setError("");
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && [401, 403].includes(e.status))
          setListing(emptyListing);
        setError(
          e instanceof Error ? e.message : "No se pudo cargar la reposición."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, revision]);

  function apply(next: RestockFilters) {
    setLoading(true);
    setNotice("");
    setFilters(next);
  }
  const reload = () => {
    setLoading(true);
    setRevision((v) => v + 1);
  };

  async function mutate(key: string, work: () => Promise<string>) {
    if (pending.current.has(key)) return;
    pending.current.add(key);
    setBusy((v) => ({ ...v, [key]: true }));
    setNotice("");
    setError("");
    try {
      setNotice(await work());
    } catch (e) {
      if (e instanceof ApiError && e.status === 409)
        setNotice(e.message + ". Se actualizó la lista.");
      else setError(e instanceof Error ? e.message : "No se pudo reintentar.");
    } finally {
      pending.current.delete(key);
      setBusy((v) => ({ ...v, [key]: false }));
      reload();
    }
  }

  function retry(n: AdminNotice, email: string) {
    if (!n.id) return;
    const question = retryConfirmation(n);
    if (question && !window.confirm(question)) return;
    void mutate(n.id, async () => {
      await call("/admin/restock/retry", {
        method: "POST",
        body: JSON.stringify({ notificationId: n.id, force: !!question }),
      });
      return `Aviso para ${email} en cola de nuevo.`;
    });
  }

  function retryAll(failed: number) {
    if (!window.confirm(bulkRetryConfirmation(failed))) return;
    void mutate("all", async () => {
      const { count } = await call<{ count: number }>(
        "/admin/restock/retry-failed",
        { method: "POST", body: "{}" }
      );
      return bulkRetryNotice(count);
    });
  }

  const { items, counts } = listing;
  const failed = counts.FAILED ?? 0;
  const filtered = hasRestockFilters(filters);
  const anyBusy = Object.values(busy).some(Boolean);
  return (
    <main className="admin-form space-y-6">
      <AdminHeading title="Reposición">
        Suscripciones y avisos de disponibilidad de tus productos. Los correos
        se envían en segundo plano cada minuto; fechas en horario de Ciudad de
        México.
      </AdminHeading>
      {!!Object.keys(counts).length && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filtrar por estado del aviso"
        >
          {chips.map((status) => {
            const active = filters.delivery === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                disabled={loading}
                onClick={() =>
                  apply({
                    ...filters,
                    delivery: active ? "" : status,
                    page: 1,
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
                  active
                    ? "border-[#232b22] bg-[#232b22] text-white"
                    : status === "FAILED" && (counts.FAILED ?? 0) > 0
                      ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                      : "border-[#c6c9c1] bg-white hover:bg-[#f0f1ec]"
                }`}
              >
                {chipLabels[status]} · {counts[status] ?? 0}
              </button>
            );
          })}
          {failed > 0 && (
            <AdminButton
              type="button"
              className="ml-auto"
              disabled={loading || anyBusy}
              pending={!!busy.all}
              onClick={() => retryAll(failed)}
            >
              Reintentar todos los fallidos
            </AdminButton>
          )}
        </div>
      )}
      <form
        key={JSON.stringify(filters)}
        className="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(11rem,1fr)_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          apply({
            q: String(form.get("q") ?? ""),
            status: String(form.get("status") ?? ""),
            delivery: String(form.get("delivery") ?? ""),
            page: 1,
          });
        }}
      >
        <label>
          Buscar por correo o producto
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={100}
            className="w-full"
          />
        </label>
        <label>
          Suscripción
          <select
            name="status"
            defaultValue={filters.status}
            className="w-full"
          >
            <option value="">Todas</option>
            {Object.keys(subscriptionColors).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Aviso
          <select
            name="delivery"
            defaultValue={filters.delivery}
            className="w-full"
          >
            <option value="">Todos</option>
            {["FAILED", "PENDING", "PROCESSING", "SENT", "CANCELLED"].map(
              (s) => (
                <option key={s} value={s}>
                  {notificationLabel(s)}
                </option>
              )
            )}
          </select>
        </label>
        <AdminButton className="shop-button" disabled={loading}>
          Aplicar filtros
        </AdminButton>
        <AdminButton
          type="button"
          disabled={loading || !filtered}
          onClick={() => apply(emptyRestockFilters)}
        >
          Limpiar
        </AdminButton>
      </form>
      {error && (
        <div role="alert">
          {error}{" "}
          <AdminButton disabled={loading} onClick={reload}>
            Reintentar carga
          </AdminButton>
        </div>
      )}
      {loading ? (
        <AdminLoading
          initial={!items.length}
          label={
            items.length
              ? "Actualizando suscripciones…"
              : "Cargando suscripciones…"
          }
        />
      ) : (
        <p role="status">{notice}</p>
      )}
      {!loading && !error && !items.length && (
        <p>
          {filtered
            ? "No hay avisos con estos filtros."
            : "No hay suscripciones en esta página."}
        </p>
      )}
      {!!items.length && (
        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr>
                {[
                  "Producto",
                  "Correo",
                  "Suscrito",
                  "Estado",
                  "Último aviso",
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const [latest, ...older] = row.notifications;
                const view =
                  latest && describeNotice(latest, row.variant.stock, now);
                return (
                  <tr key={row.id} className="align-top">
                    <td>
                      <p className="font-medium">{row.variant.product.name}</p>
                      <p className="text-[#676d60]">
                        {row.variant.size} / {row.variant.color}
                        {typeof row.variant.stock === "number" &&
                          ` · ${row.variant.stock} en stock`}
                      </p>
                    </td>
                    <td className="break-all">{row.email}</td>
                    <td className="whitespace-nowrap">
                      {row.createdAt ? formatRestockDate(row.createdAt) : "—"}
                    </td>
                    <td>
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs whitespace-nowrap ${
                          subscriptionColors[row.status] ?? toneColors.muted
                        }`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="space-y-2">
                      {!latest || !view ? (
                        <span className="text-[#676d60]">
                          Sin avisos todavía
                        </span>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-xs whitespace-nowrap ${toneColors[view.tone]}`}
                            >
                              {view.label}
                            </span>
                            {latest.retry && latest.id && (
                              <AdminButton
                                type="button"
                                variant={
                                  latest.retry === "needs-confirmation"
                                    ? "danger"
                                    : "secondary"
                                }
                                className="min-h-8! px-3! py-1!"
                                disabled={loading || anyBusy}
                                pending={!!busy[latest.id]}
                                aria-label={`Reintentar aviso para ${row.email}`}
                                onClick={() => retry(latest, row.email)}
                              >
                                Reintentar
                              </AdminButton>
                            )}
                          </div>
                          {view.detail && (
                            <p className="text-xs text-[#676d60]">
                              {view.detail}
                            </p>
                          )}
                          {older.length > 0 && (
                            <p className="text-xs text-[#8d9486]">
                              {older.length === 1
                                ? "1 aviso anterior"
                                : `${older.length} avisos anteriores`}
                            </p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <nav
        className="flex flex-wrap gap-4"
        aria-label="Paginación de reposición"
      >
        <AdminButton
          disabled={loading || filters.page === 1}
          onClick={() => apply({ ...filters, page: filters.page - 1 })}
        >
          Anterior
        </AdminButton>
        <span>
          Página {filters.page}
          {listing.pages ? ` de ${listing.pages}` : ""}
          {listing.total !== null &&
            ` · ${listing.total} ${listing.total === 1 ? "suscripción" : "suscripciones"}`}
        </span>
        <AdminButton
          disabled={loading || !!error || !hasNextPage(listing)}
          onClick={() => apply({ ...filters, page: filters.page + 1 })}
        >
          Siguiente
        </AdminButton>
      </nav>
    </main>
  );
}
