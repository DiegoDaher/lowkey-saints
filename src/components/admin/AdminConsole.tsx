"use client";
import Loader from "@/components/ui/Loader";
import Link from "next/link";
import { statusLabel } from "@/lib/status-label";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AdminProfile as Role } from "../../../supabase/functions/_shared/admin-access";
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
  "usuarios",
] as const;
export default function AdminConsole({
  initialProfile,
}: {
  initialProfile: Role;
}) {
  const [role, setRole] = useState<Role | null>(initialProfile);
  const [tab, setTab] = useState<string>("inicio");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const [page, setPage] = useState(1);
  const [subs, setSubs] = useState<Subscription[]>([]);

  const call = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const { data } = await supabaseBrowser().auth.getSession();
      try {
        if (!data.session) throw new ApiError(401, "Inicia sesión de nuevo");
        return await api<T>(path, options, data.session.access_token);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          setSubs([]);

          setRole(null);
          window.location.replace(
            error.status === 401 ? "/401" : "/140210/sin-acceso"
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
            [
              "productos",
              "inventario",
              "ordenes",
              "finanzas",
              "usuarios",
            ].includes(s) ? (
              <Link key={s} href={"/140210/" + s} className="border px-4 py-3">
                {s}
              </Link>
            ) : (
              <button
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

      {loading && <Loader label="Cargando administración…" />}
      <div hidden={loading} aria-busy={loading} className="space-y-7">
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
        {tab !== "inicio" && (
          <div className="flex gap-5">
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>Página {page}</span>
            <button disabled={loading} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
