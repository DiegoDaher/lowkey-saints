"use client";
import Loader from "@/components/ui/Loader";
import { useState } from "react";
import { api } from "@/lib/api";
import StoreAction from "@/components/ui/StoreAction";
export default function Unsubscribe() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto max-w-xl space-y-6 p-12">
      <h1 className="text-3xl">Cancelar avisos de reposición</h1>
      <StoreAction
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/unsubscribe", {
              method: "POST",
              body: JSON.stringify({
                token: new URLSearchParams(window.location.search).get("token"),
              }),
            });
            setMessage("Tus avisos se cancelaron.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <Loader
            announce={false}
            variant="inline"
            label="Cancelando avisos…"
          />
        ) : (
          "Confirmar baja"
        )}
      </StoreAction>
      <p role="status">{message}</p>
    </main>
  );
}
