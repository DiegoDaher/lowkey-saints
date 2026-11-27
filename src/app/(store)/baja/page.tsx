"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Spinner from "@/components/ui/Spinner";
import StoreAction from "@/components/ui/StoreAction";
import { api, ApiError } from "@/lib/api";

const TOKEN = /^[0-9a-f-]{36}$/i;

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; token: string; busy: boolean; error: string }
  | { kind: "done" };

function unsubscribeError(error: unknown) {
  if (error instanceof ApiError && error.status === 400)
    return "El enlace no es válido. Ábrelo de nuevo desde el correo que te enviamos.";
  if (error instanceof ApiError && error.status === 429)
    return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  return "No pudimos cancelar tus avisos. Intenta de nuevo.";
}

export default function Unsubscribe() {
  const [state, setState] = useState<State>({ kind: "loading" });

  // The token only exists in the browser URL, read it after mount.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL after hydration
    setState(
      token && TOKEN.test(token)
        ? { kind: "ready", token, busy: false, error: "" }
        : { kind: "missing" }
    );
  }, []);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-12">
      <h1 className="text-3xl">Cancelar avisos de reposición</h1>
      {state.kind === "missing" && (
        <p>
          Para cancelar un aviso usa el enlace “Cancelar avisos” del correo que
          te enviamos. Así confirmamos que el correo es tuyo.
        </p>
      )}
      {state.kind === "ready" && (
        <>
          <p>
            Dejarás de recibir el aviso de disponibilidad de este producto.
            Puedes volver a pedirlo desde su página cuando quieras.
          </p>
          <StoreAction
            disabled={state.busy}
            aria-busy={state.busy}
            onClick={async () => {
              if (state.busy) return;
              setState({ ...state, busy: true, error: "" });
              try {
                await api("/unsubscribe", {
                  method: "POST",
                  body: JSON.stringify({ token: state.token }),
                });
                setState({ kind: "done" });
              } catch (e) {
                setState({ ...state, busy: false, error: unsubscribeError(e) });
              }
            }}
          >
            {state.busy ? (
              <Spinner announce={false} label="Cancelando avisos…" />
            ) : (
              "Confirmar baja"
            )}
          </StoreAction>
          {state.error && (
            <p className="store-status text-sale" role="alert">
              {state.error}
            </p>
          )}
        </>
      )}
      <div role="status">
        {state.kind === "done" && (
          <div className="space-y-3">
            <p className="font-semibold">Tus avisos se cancelaron.</p>
            <p>
              No te enviaremos más correos de reposición para este producto.
            </p>
            <Link
              className="store-link inline-flex min-h-11 items-center"
              href="/"
            >
              Volver a la tienda
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
