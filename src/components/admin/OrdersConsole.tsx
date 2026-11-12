"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { statusLabel } from "@/lib/status-label";
import type {
  AdminOrder,
  OrderAction,
  OrderStatus,
  OrderHistoryEntry,
} from "../../../supabase/functions/_shared/contracts";

const colors: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-950",
  CONFIRMED: "bg-blue-100 text-blue-950",
  SHIPPED: "bg-green-100 text-green-950",
  CANCELLED: "bg-red-100 text-red-950",
};
const actions: Record<OrderAction, string> = {
  CONFIRMED: "Confirmar pago",
  SHIPPED: "Marcar enviado",
  CANCELLED: "Cancelar",
};
const origins = {
  CHECKOUT: "Compra",
  MANUAL: "Manual",
  EXPIRATION: "Expiración automática",
};
const date = (value: string) =>
  new Date(value).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

async function call<T>(path: string, options: RequestInit = {}) {
  const { data } = await supabaseBrowser().auth.getSession();
  if (!data.session) throw new ApiError(401, "Inicia sesión de nuevo");
  return api<T>(path, options, data.session.access_token);
}

function History({ orderId, revision }: { orderId: string; revision: number }) {
  const [entries, setEntries] = useState<OrderHistoryEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void call<OrderHistoryEntry[]>(`/admin/orders/${orderId}/history`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setEntries(value);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [orderId, revision]);
  return (
    <div className="space-y-2 pt-3">
      {error && <p role="alert">{error}</p>}
      {!entries && !error && <p role="status">Cargando historial…</p>}
      {entries && !entries.some((entry) => entry.source === "CHECKOUT") && (
        <p>
          Historial previo no disponible. Este pedido puede tener un historial
          incompleto.
        </p>
      )}
      <ol className="space-y-2">
        {entries?.map((entry) => (
          <li key={entry.id}>
            <time dateTime={entry.createdAt}>{date(entry.createdAt)}</time>
            {" · "}
            {entry.fromStatus
              ? `${statusLabel(entry.fromStatus)} → `
              : "Creación → "}
            {statusLabel(entry.toStatus)} · {origins[entry.source]}
            {entry.actorId && (
              <span className="break-all"> · Operador: {entry.actorId}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function OrdersConsole() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(0);
  const saving = Object.values(busy).some(Boolean);
  const request = useRef<AbortController | null>(null);
  const pending = useRef(new Set<string>());

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const value = await call<AdminOrder[]>(
        `/admin/orders?page=${page}${filter ? `&status=${filter}` : ""}`,
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      setOrders(value);
      setError("");
      setRevision((v) => v + 1);
      setNow(Date.now());
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    // Fetches external data; defer the loading update to the async task.
    void Promise.resolve().then(load);
    const refresh = () => {
      if (document.visibilityState === "visible" && pending.current.size === 0)
        void load();
    };
    const poll = window.setInterval(refresh, 30_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      request.current?.abort();
      window.clearInterval(poll);
      window.clearInterval(tick);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  async function transition(order: AdminOrder, status: OrderAction) {
    if (
      pending.current.has(order.id) ||
      !window.confirm(`${actions[status]} — pedido #${order.orderNumber}?`)
    )
      return;
    pending.current.add(order.id);
    setBusy((value) => ({ ...value, [order.id]: true }));
    setNotice("");
    setError("");
    request.current?.abort();
    try {
      await call<AdminOrder>(`/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      setNotice(`Pedido #${order.orderNumber}: ${statusLabel(status)}.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        await load();
        setNotice(`${e.message}. Se actualizaron los pedidos.`);
      } else setError((e as Error).message);
    } finally {
      pending.current.delete(order.id);
      setBusy((value) => ({ ...value, [order.id]: false }));
      setLoading(false);
    }
  }

  return (
    <main className="admin-form mx-auto w-full max-w-7xl space-y-6 p-6 md:p-10">
      <Link href="/admin" className="underline">
        Volver a administración
      </Link>
      <h1 className="font-display text-4xl">Pedidos</h1>
      <p>
        Fechas en horario de Ciudad de México. Actualización automática cada 30
        segundos.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="order-status">Estado</label>
          <select
            id="order-status"
            disabled={saving}
            className="ml-3 border p-2"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
              setOrders([]);
            }}
          >
            <option value="">Todos</option>
            {Object.keys(colors).map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <button
          className="shop-button"
          disabled={loading || saving}
          onClick={() => void load()}
        >
          Actualizar
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p role="status" aria-live="polite">
        {loading ? "Actualizando pedidos…" : notice}
      </p>
      {!loading && !error && orders.length === 0 && (
        <p>No hay pedidos en esta página.</p>
      )}
      <div className="space-y-4">
        {orders.map((order) => {
          const expired =
            order.status === "PENDING_PAYMENT" &&
            new Date(order.expiresAt).getTime() <= now;
          return (
            <section
              key={order.id}
              aria-label={`Pedido #${order.orderNumber}`}
              className="space-y-3 border p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl">#{order.orderNumber}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${colors[order.status]}`}
                >
                  {statusLabel(order.status)}
                </span>
                {expired && <span>Reserva vencida</span>}
              </div>
              <p>
                {order.clientName} · {order.clientPhone}
              </p>
              <ul>
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.quantity} × {item.productName} / {item.size} /{" "}
                    {item.color} · $ {item.price}
                  </li>
                ))}
              </ul>
              <p>Total $ {order.totalAmount} MXN</p>
              <p>
                Creado: {date(order.createdAt)} · Vencimiento de reserva:{" "}
                {date(order.expiresAt)}
              </p>
              <div className="flex flex-wrap gap-3">
                {order.availableActions
                  .filter((action) => !(action === "CONFIRMED" && expired))
                  .map((action) => (
                    <button
                      key={action}
                      className="shop-button"
                      disabled={busy[order.id]}
                      onClick={() => void transition(order, action)}
                    >
                      {actions[action]}
                    </button>
                  ))}
                {busy[order.id] && <span role="status">Guardando…</span>}
              </div>
              <details
                onToggle={(e) => {
                  const open = e.currentTarget.open;
                  setExpanded((value) => ({ ...value, [order.id]: open }));
                }}
              >
                <summary className="cursor-pointer underline">
                  Historial
                </summary>
                {expanded[order.id] && (
                  <History orderId={order.id} revision={revision} />
                )}
              </details>
            </section>
          );
        })}
      </div>
      <nav
        className="flex items-center gap-4"
        aria-label="Paginación de pedidos"
      >
        <button
          disabled={page === 1 || loading || saving}
          onClick={() => {
            setPage((v) => v - 1);
            setOrders([]);
          }}
        >
          Anterior
        </button>
        <span>Página {page}</span>
        <button
          disabled={orders.length < 50 || loading || saving}
          onClick={() => {
            setPage((v) => v + 1);
            setOrders([]);
          }}
        >
          Siguiente
        </button>
      </nav>
    </main>
  );
}
