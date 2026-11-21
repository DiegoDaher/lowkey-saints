"use client";
import AdminButton from "./AdminButton";
import { useActionState } from "react";
import Link from "next/link";
import { login, requestRecovery, resetPassword } from "@/server/auth/actions";

export default function AuthForm({
  mode,
}: {
  mode: "login" | "recover" | "reset";
}) {
  const action =
    mode === "login"
      ? login
      : mode === "recover"
        ? requestRecovery
        : resetPassword;
  const [state, formAction, pending] = useActionState(action, {});
  const title =
    mode === "login"
      ? "Acceso al equipo"
      : mode === "recover"
        ? "Recuperar contraseña"
        : "Nueva contraseña";
  return (
    <main className="admin-form mx-auto w-full max-w-md space-y-6 p-8">
      <h1 className="font-display text-4xl">{title}</h1>
      <form action={formAction} className="space-y-4">
        {mode !== "reset" && (
          <label>
            Correo
            <input
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
            />
          </label>
        )}
        {mode !== "recover" && (
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "reset" ? 12 : undefined}
              maxLength={mode === "reset" ? 128 : 1024}
              required
            />
          </label>
        )}
        {mode === "reset" && (
          <label>
            Confirmar contraseña
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        )}
        <AdminButton
          disabled={pending}
          aria-busy={pending}
          className="shop-button"
        >
          {pending
            ? "Procesando…"
            : mode === "login"
              ? "Entrar"
              : mode === "recover"
                ? "Enviar instrucciones"
                : "Guardar contraseña"}
        </AdminButton>
      </form>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
      <Link
        className="underline"
        href={
          mode === "login" || mode === "reset"
            ? "/140210/recuperar"
            : "/140210/login"
        }
      >
        {mode === "login"
          ? "Olvidé mi contraseña"
          : mode === "reset"
            ? "Solicitar otro enlace"
            : "Volver al acceso"}
      </Link>
    </main>
  );
}
