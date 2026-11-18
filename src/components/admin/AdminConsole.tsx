"use client";
import Loader from "@/components/ui/Loader";
import Link from "next/link";
import { statusLabel } from "@/lib/status-label";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AdminProfile as Role } from "../../../supabase/functions/_shared/admin-access";
type Finance = {
  id: string;
  name: string;
  salePrice: string;
  costPrice: string | null;
  margin: { amount: number; percent: number | null } | null;
};
type Subscription = {
  id: string;
  email: string;
  status: string;
  variant: { size: string; color: string; product: { name: string } };
  notifications: {
    status: string;
    attempts: number;
    lastError: string | null;
  }[];
};
const sections = [
  "productos",
  "inventario",
  "ordenes",
  "restock",
  "finanzas",
  "roles",
] as const;
export default function AdminConsole({
  initialProfile,
}: {
  initialProfile: Role;
}) {
  const [role, setRole] = useState<Role | null>(initialProfile);
  const [tab, setTab] = useState<string>("inicio");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const [page, setPage] = useState(1);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [finances, setFinances] = useState<Finance[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const call = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const { data } = await supabaseBrowser().auth.getSession();
      try {
        if (!data.session) throw new ApiError(401, "Inicia sesión de nuevo");
        return await api<T>(path, options, data.session.access_token);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          setSubs([]);
          setFinances([]);
          setRoles([]);
          setRole(null);
          window.location.replace(
            error.status === 401 ? "/admin/login" : "/admin/sin-acceso"
          );
        }
        throw error;
      }
    },
    []
  );
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const options = { signal: controller.signal };
    setLoading(true);
    try {
      const me = await call<Role>("/admin/me", options);
      if (controller.signal.aborted) return;
      setRole(me);
      setError("");
      if (tab !== "inicio" && me.role !== "ADMIN") {
        setFinances([]);
        setRoles([]);
        setSubs([]);
        setTab("inicio");
        return;
      }
      if (tab === "restock") {
        const rows = await call<Subscription[]>(
          "/admin/restock?page=" + page,
          options
        );
        if (!controller.signal.aborted) setSubs(rows);
      }
      if (tab === "finanzas") {
        const rows = await call<Finance[]>(
          "/admin/finances?page=" + page,
          options
        );
        if (!controller.signal.aborted) setFinances(rows);
      }
      if (tab === "roles") {
        const rows = await call<Role[]>("/admin/roles", options);
        if (!controller.signal.aborted) setRoles(rows);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [call, tab, page]);
  // This effect fetches external data; its updates occur after network promises settle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Updates follow the API request.
    void load();
    return () => request.current?.abort();
  }, [load]);
  async function act(path: string, method: string, value: unknown) {
    setBusy(true);
    setError("");
    try {
      await call(path, { method, body: JSON.stringify(value) });
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-form mx-auto w-full max-w-7xl space-y-7 p-6 md:p-10">
      <div className="flex flex-wrap justify-between gap-4">
        <h1 className="font-display text-4xl">Administración</h1>
      </div>
      <nav className="flex flex-wrap gap-3" aria-label="Administración">
        {sections
          .filter(
            (s) =>
              role?.role === "ADMIN" || ["inventario", "ordenes"].includes(s)
          )
          .map((s) =>
            ["productos", "inventario", "ordenes"].includes(s) ? (
              <Link key={s} href={"/admin/" + s} className="border px-4 py-3">
                {s}
              </Link>
            ) : (
              <button
                disabled={busy}
                aria-current={tab === s ? "page" : undefined}
                className={tab === s ? "shop-button" : "border px-4 py-3"}
                key={s}
                onClick={() => {
                  setTab(s);
                  setPage(1);
                }}
              >
                {s}
              </button>
            )
          )}
      </nav>
      <p role="alert">{error}</p>
      {busy && <Loader variant="inline" label="Procesando…" />}
      {loading && <Loader label="Cargando administración…" />}
      <div hidden={loading} aria-busy={busy} className="space-y-7">
        {tab === "inicio" && (
          <p>Selecciona una sección para administrar la tienda.</p>
        )}
        {role?.role === "ADMIN" && tab === "restock" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["Producto", "Variante", "Correo", "Estado", "Envíos"].map(
                    (s) => (
                      <th key={s}>{s}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td>{s.variant.product.name}</td>
                    <td>
                      {s.variant.size} / {s.variant.color}
                    </td>
                    <td>{s.email}</td>
                    <td>{statusLabel(s.status)}</td>
                    <td>
                      {s.notifications.map((n, i) => (
                        <p key={i}>
                          {statusLabel(n.status)} · {n.attempts} intentos{" "}
                          {n.lastError}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {role?.role === "ADMIN" && tab === "finanzas" && (
          <div className="space-y-4">
            <p>
              Utilidad bruta = precio − costo. Los productos sin costo no tienen
              margen calculado.
            </p>
            {finances.map((f) => (
              <form
                className="grid items-end gap-3 border p-4 md:grid-cols-4"
                key={f.id}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  await act("/admin/finances", "PUT", {
                    productId: f.id,
                    costPrice: data.get("cost"),
                  });
                }}
              >
                <div>
                  <h2>{f.name}</h2>
                  <p>Venta $ {f.salePrice}</p>
                </div>
                <label>
                  Costo MXN
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={f.costPrice || ""}
                    required
                  />
                </label>
                <p
                  className={
                    f.margin && f.margin.amount < 0 ? "text-red-700" : ""
                  }
                >
                  Utilidad:{" "}
                  {f.margin
                    ? "$ " +
                      f.margin.amount.toFixed(2) +
                      " / " +
                      (f.margin.percent === null
                        ? "Sin porcentaje"
                        : f.margin.percent.toFixed(2) + "%")
                    : "Sin costo"}
                </p>
                <button disabled={busy || loading} className="shop-button">
                  Guardar costo
                </button>
              </form>
            ))}
          </div>
        )}
        {role?.role === "ADMIN" && tab === "roles" && (
          <>
            <p>
              El usuario debe existir en Supabase Auth. No puedes modificar tu
              propio rol.
            </p>
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await act("/admin/roles", "PUT", {
                  id: f.get("id"),
                  role: f.get("role"),
                  active: f.get("active") === "on",
                });
              }}
            >
              <label>
                UUID del usuario
                <input name="id" required />
              </label>
              <label>
                Rol
                <select name="role">
                  <option>OPERATOR</option>
                  <option>ADMIN</option>
                </select>
              </label>
              <label>
                <input name="active" type="checkbox" defaultChecked /> Activo
              </label>
              <button disabled={busy || loading} className="shop-button">
                Guardar permisos
              </button>
            </form>
            <ul>
              {roles.map((r) => (
                <li className="border-b py-3" key={r.id}>
                  {r.id} · {r.role} · {r.active ? "Activo" : "Desactivado"}
                </li>
              ))}
            </ul>
          </>
        )}
        {tab !== "roles" && tab !== "inicio" && (
          <div className="flex gap-5">
            <button
              disabled={page === 1 || busy || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>Página {page}</span>
            <button
              disabled={busy || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
