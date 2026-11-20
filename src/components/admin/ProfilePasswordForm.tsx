"use client";
import { useActionState } from "react";
import { changePassword } from "@/server/auth/actions";

export default function ProfilePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  return (
    <section className="space-y-4">
      <h2 className="text-2xl">Cambiar contraseña</h2>
      <p>
        Usa entre 12 y 128 caracteres. Al guardar tendrás que iniciar sesión de
        nuevo.
      </p>
      <form action={action} className="space-y-4">
        <label>
          Contraseña actual
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
          />
        </label>
        <label>
          Nueva contraseña
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <label>
          Confirmar nueva contraseña
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <button className="shop-button" disabled={pending} aria-busy={pending}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
      {state.error && <p role="alert">{state.error}</p>}
    </section>
  );
}
