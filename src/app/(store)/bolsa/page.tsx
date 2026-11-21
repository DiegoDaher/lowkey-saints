"use client";
import Spinner from "@/components/ui/Spinner";
import { useState } from "react";
import { statusLabel } from "@/lib/status-label";
import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format-price";
import StoreAction from "@/components/ui/StoreAction";
import type { OrderReceipt } from "../../../../supabase/functions/_shared/contracts";
export default function Bag() {
  const { items, quantity, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12">
      <h1 className="font-display text-4xl">Tu bolsa</h1>
      {receipt ? (
        <section className="store-panel store-receipt space-y-4 p-5 sm:p-8">
          <h2>
            Pedido #{receipt.orderNumber} · {statusLabel(receipt.status)}
          </h2>
          <p>Total confirmado: {formatPrice(Number(receipt.totalAmount))}</p>
          <p>
            Reserva hasta {new Date(receipt.expiresAt).toLocaleString("es-MX")}
          </p>
          <StoreAction
            href={receipt.whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            Continuar en WhatsApp
          </StoreAction>
        </section>
      ) : (
        <>
          {items.length ? (
            items.map((i) => (
              <div
                className="border-line flex flex-wrap items-center justify-between gap-3 border-b py-4"
                key={i.variantId}
              >
                <div>
                  {i.name}
                  <p className="text-sm">
                    {i.size} / {i.color} · {formatPrice(Number(i.price))}
                  </p>
                </div>
                <label>
                  Cantidad
                  <input
                    className="store-field ml-3 w-16 border p-2"
                    type="number"
                    min="0"
                    max="20"
                    value={i.quantity}
                    disabled={busy}
                    onChange={(e) =>
                      quantity(i.variantId, Number(e.target.value))
                    }
                  />
                </label>
              </div>
            ))
          ) : (
            <p>Tu bolsa está vacía.</p>
          )}
          {items.length > 0 && (
            <form
              className="store-panel space-y-4 p-5 sm:p-8"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const payload = {
                    clientName: data.get("name"),
                    clientPhone: data.get("phone"),
                    items: items.map(({ variantId, quantity }) => ({
                      variantId,
                      quantity,
                    })),
                  };
                  const signature = JSON.stringify(payload);
                  let pending;
                  try {
                    pending = JSON.parse(
                      localStorage.getItem("lowkey-pending-order") || "null"
                    );
                  } catch {}
                  if (!pending || pending.signature !== signature)
                    pending = { signature, key: crypto.randomUUID() };
                  localStorage.setItem(
                    "lowkey-pending-order",
                    JSON.stringify(pending)
                  );
                  const result = await api<OrderReceipt>("/orders", {
                    method: "POST",
                    body: JSON.stringify({
                      ...payload,
                      idempotencyKey: pending.key,
                    }),
                  });
                  setReceipt(result);
                  clear();
                  localStorage.removeItem("lowkey-pending-order");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Subtotal estimado:{" "}
                {formatPrice(
                  items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
                )}
                . La disponibilidad y el precio se confirman al crear tu pedido.
              </p>
              <label className="block">
                Nombre
                <input
                  disabled={busy}
                  className="store-field mt-2 block w-full border p-3"
                  name="name"
                  required
                  maxLength={100}
                />
              </label>
              <label className="block">
                Teléfono
                <input
                  disabled={busy}
                  className="store-field mt-2 block w-full border p-3"
                  name="phone"
                  type="tel"
                  required
                  minLength={8}
                  maxLength={25}
                />
              </label>
              <p>
                Reservaremos tus piezas durante 24 horas. El pago y la entrega
                se coordinan por WhatsApp.
              </p>
              <StoreAction
                type="submit"
                disabled={busy}
                aria-busy={busy}
                className="w-full sm:w-auto"
              >
                {busy ? (
                  <Spinner
                    announce={false}

                    label="Creando pedido…"
                  />
                ) : (
                  "Crear pedido"
                )}
              </StoreAction>
            </form>
          )}
        </>
      )}
      <p role="alert">{error}</p>
      <Link
        href="/#catalogo"
        className="store-link inline-flex min-h-11 items-center"
      >
        Seguir comprando
      </Link>
    </main>
  );
}
