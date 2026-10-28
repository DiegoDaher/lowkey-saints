"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { api } from "@/lib/api";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="admin-form mx-auto w-full max-w-md space-y-6 p-8">
      <h1 className="font-display text-4xl">Acceso al equipo</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const client = supabaseBrowser();
            const { data, error } = await client.auth.signInWithPassword({
              email: String(f.get("email")),
              password: String(f.get("password")),
            });
            if (error) throw error;
            await api("/admin/me", {}, data.session!.access_token);
            router.replace("/admin");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Correo
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button disabled={busy} className="shop-button">
          {busy ? "Ingresando…" : "Entrar"}
        </button>
      </form>
      <p role="alert">{error}</p>
    </main>
  );
}
