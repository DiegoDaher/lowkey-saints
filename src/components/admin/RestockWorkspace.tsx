"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { statusLabel } from "@/lib/status-label";
import AdminButton from "./AdminButton";
import { AdminHeading, AdminLoading } from "./AdminFeedback";
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
export default function RestockWorkspace() {
  const [rows, setRows] = useState<Subscription[]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const {
          data: { session },
        } = await supabaseBrowser().auth.getSession();
        if (!session) throw new ApiError(401, "Inicia sesión de nuevo");
        const result = await api<Subscription[]>(
          "/admin/restock?page=" + page,
          { signal: controller.signal },
          session.access_token
        );
        if (!controller.signal.aborted) {
          setRows(result);
          setError("");
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setRows([]);
          window.location.replace(
            e.status === 401 ? "/401" : "/140210/sin-acceso"
          );
        }
        setError(
          e instanceof Error ? e.message : "No se pudo cargar la reposición."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, revision]);
  return (
    <main className="admin-form space-y-6">
      <AdminHeading title="Reposición">
        Suscripciones y avisos de disponibilidad de tus productos.
      </AdminHeading>
      {error && (
        <div role="alert">
          {error}{" "}
          <AdminButton
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRevision((v) => v + 1);
            }}
          >
            Reintentar carga
          </AdminButton>
        </div>
      )}
      {loading && (
        <AdminLoading
          initial={!rows.length}
          label={
            rows.length
              ? "Actualizando suscripciones…"
              : "Cargando suscripciones…"
          }
        />
      )}
      {!loading && !error && !rows.length && (
        <p>No hay suscripciones en esta página.</p>
      )}
      {!!rows.length && (
        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full">
            <thead>
              <tr>
                {["Producto", "Variante", "Correo", "Estado", "Envíos"].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.variant.product.name}</td>
                  <td>
                    {row.variant.size} / {row.variant.color}
                  </td>
                  <td>{row.email}</td>
                  <td>{statusLabel(row.status)}</td>
                  <td>
                    {row.notifications.map((n, i) => (
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
      <nav className="flex gap-4" aria-label="Paginación de reposición">
        <AdminButton
          disabled={loading || page === 1}
          onClick={() => {
            setLoading(true);
            setPage((p) => p - 1);
          }}
        >
          Anterior
        </AdminButton>
        <span>Página {page}</span>
        <AdminButton
          disabled={loading || !!error || rows.length < 50}
          onClick={() => {
            setLoading(true);
            setPage((p) => p + 1);
          }}
        >
          Siguiente
        </AdminButton>
      </nav>
    </main>
  );
}
