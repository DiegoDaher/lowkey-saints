"use client";
import { useState } from "react";
import { api } from "@/lib/api";
export default function Unsubscribe() {
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto max-w-xl space-y-6 p-12">
      <h1 className="text-3xl">Cancelar avisos de reposición</h1>
      <button
        className="shop-button"
        onClick={async () => {
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
          }
        }}
      >
        Confirmar baja
      </button>
      <p role="status">{message}</p>
    </main>
  );
}
