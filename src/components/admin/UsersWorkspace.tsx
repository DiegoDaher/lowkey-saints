"use client";
import { AdminLoading } from "./AdminFeedback";
import AdminButton from "./AdminButton";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AdminRole } from "../../../supabase/functions/_shared/admin-access";

type User = { id: string; email: string; role: AdminRole; active: boolean };
type Listing = { users: User[]; page: number; hasMore: boolean };

export default function UsersWorkspace({ ownId }: { ownId: string }) {
  const [listing, setListing] = useState<Listing>({
    users: [],
    page: 1,
    hasMore: false,
  });
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const call = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      try {
        const { data } = await supabaseBrowser().auth.getSession();
        if (!data.session) throw new ApiError(401, "Inicia sesión de nuevo");
        return await api<T>(path, options, data.session.access_token);
      } catch (e) {
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setListing({ users: [], page: 1, hasMore: false });
          window.location.replace(
            e.status === 401 ? "/140210/login" : "/140210/sin-acceso"
          );
        }
        throw e;
      }
    },
    []
  );
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Only updates after the asynchronous session/API request settles.
    void call<Listing>("/admin/users?page=" + page, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setListing(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [call, page, version]);

  async function mutate(path: string, method: string, body?: unknown) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setOperation(
      path === "/admin/roles" ? path + "/" + (body as { id: string }).id : path
    );
    setError("");
    setMessage("");
    try {
      const result = await call<{ message?: string }>(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setMessage(result.message || "Permisos actualizados.");
      setLoading(true);
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
      setOperation("");
    }
  }

  return (
    <main className="admin-form mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      <Link prefetch={false} className="underline" href="/140210">
        Volver a administración
      </Link>
      <h1 className="font-display text-4xl">Usuarios</h1>
      <section className="space-y-4" aria-labelledby="create-user">
        <h2 id="create-user" className="text-2xl">
          Crear usuario
        </h2>
        <p>Recibirá un enlace por correo para establecer su contraseña.</p>
        <form
          className="grid gap-4 md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            if (
              await mutate("/admin/users", "POST", {
                email: values.get("email"),
                role: values.get("role"),
              })
            )
              form.reset();
          }}
        >
          <label>
            Correo
            <input
              name="email"
              type="email"
              maxLength={254}
              required
              autoComplete="off"
            />
          </label>
          <label>
            Rol
            <select name="role" defaultValue="OPERATOR">
              <option>OPERATOR</option>
              <option>ADMIN</option>
            </select>
          </label>
          <AdminButton
            pending={busy && operation === "/admin/users"}
            className="shop-button"
            disabled={busy || loading}
          >
            Crear usuario
          </AdminButton>
        </form>
      </section>
      {error && (
        <div role="alert">
          {error}{" "}
          <AdminButton
            disabled={busy || loading}
            onClick={() => {
              setLoading(true);
              setVersion((v) => v + 1);
            }}
          >
            Reintentar carga
          </AdminButton>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {loading && (
        <AdminLoading
          initial={!listing.users.length}
          label={
            listing.users.length
              ? "Actualizando usuarios…"
              : "Cargando usuarios…"
          }
        />
      )}
      <section
        className="space-y-4"
        aria-label="Usuarios existentes"
        aria-busy={busy || loading}
      >
        {!loading && listing.users.length === 0 && (
          <p>No hay usuarios en esta página.</p>
        )}
        {listing.users.map((user) => (
          <article className="space-y-3 border p-4" key={user.id}>
            <h2 className="text-xl break-all">
              {user.email}
              {user.id === ownId ? " (tú)" : ""}
            </h2>
            <form
              key={`${user.role}-${user.active}`}
              className="flex flex-wrap items-end gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                await mutate("/admin/roles", "PUT", {
                  id: user.id,
                  role: values.get("role"),
                  active: values.get("active") === "on",
                });
              }}
            >
              <label>
                Rol de {user.email}
                <select
                  name="role"
                  defaultValue={user.role}
                  disabled={user.id === ownId || busy || loading}
                >
                  <option>OPERATOR</option>
                  <option>ADMIN</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={user.active}
                  disabled={user.id === ownId || busy || loading}
                />{" "}
                Activo
              </label>
              <AdminButton
                className="shop-button"
                pending={busy && operation === "/admin/roles/" + user.id}
                disabled={user.id === ownId || busy || loading}
              >
                Guardar permisos
              </AdminButton>
            </form>
            <AdminButton
              className="underline"
              pending={
                busy && operation === `/admin/users/${user.id}/password-link`
              }
              disabled={!user.active || busy || loading}
              onClick={() => {
                if (
                  window.confirm(
                    `¿Enviar a ${user.email} un enlace para establecer su contraseña?`
                  )
                )
                  void mutate(`/admin/users/${user.id}/password-link`, "POST");
              }}
            >
              Enviar enlace para establecer contraseña
            </AdminButton>
          </article>
        ))}
      </section>
      <nav className="flex gap-4" aria-label="Paginación de usuarios">
        <AdminButton
          disabled={busy || loading || page === 1}
          onClick={() => {
            setLoading(true);
            setError("");
            setPage(page - 1);
          }}
        >
          Anterior
        </AdminButton>
        <span>Página {page}</span>
        <AdminButton
          disabled={busy || loading || !listing.hasMore}
          onClick={() => {
            setLoading(true);
            setError("");
            setPage(page + 1);
          }}
        >
          Siguiente
        </AdminButton>
      </nav>
    </main>
  );
}
