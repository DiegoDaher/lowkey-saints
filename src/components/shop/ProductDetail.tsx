"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";
import { useCart } from "./CartProvider";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format-price";
export default function ProductDetail({
  product: p,
}: {
  product: CatalogProduct;
}) {
  const [variantId, setVariant] = useState(p.variants[0]?.id || "");
  const [image, setImage] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const cart = useCart();
  const v = p.variants.find((v) => v.id === variantId);
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link href="/#catalogo">← Catálogo</Link>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <div className="relative aspect-[4/5] bg-stone-100">
            <Image
              fill
              unoptimized
              className="object-cover"
              src={p.images[image]?.url || "/images/hero-editorial.svg"}
              alt={p.images[image]?.alt || p.name}
            />
          </div>
          <div className="mt-3 flex gap-2">
            {p.images.map((im, i) => (
              <button
                aria-label={"Ver imagen " + (i + 1)}
                key={im.id}
                onClick={() => setImage(i)}
                className="relative h-20 w-16 border"
              >
                <Image
                  fill
                  unoptimized
                  className="object-cover"
                  src={im.url}
                  alt={im.alt}
                />
              </button>
            ))}
          </div>
        </div>
        <section className="space-y-6">
          <p>{p.categories.map((c) => c.category.name).join(" / ")}</p>
          <h1 className="font-display text-5xl uppercase">{p.name}</h1>
          <p className="text-xl">{formatPrice(Number(p.salePrice))}</p>
          <p>{p.description}</p>
          <label className="block">
            Talla y color
            <select
              className="mt-2 block w-full border p-3"
              value={variantId}
              onChange={(e) => {
                setVariant(e.target.value);
                setMessage("");
              }}
            >
              {p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.size} / {v.color} — {v.stock ? "Disponible" : "Agotado"}
                </option>
              ))}
            </select>
          </label>
          {v && v.stock > 0 ? (
            <>
              <p>{v.stock <= 3 ? "Quedan pocas unidades" : "Disponible"}</p>
              <button
                className="shop-button"
                onClick={() => {
                  cart.add({
                    variantId: v.id,
                    name: p.name,
                    size: v.size,
                    color: v.color,
                    price: p.salePrice,
                  });
                  setMessage("Agregado a tu bolsa");
                }}
              >
                Agregar a la bolsa
              </button>
              <Link className="ml-5 underline" href="/bolsa">
                Ver bolsa
              </Link>
            </>
          ) : v ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await api("/restock", {
                    method: "POST",
                    body: JSON.stringify({
                      email: form.get("email"),
                      variantId: v.id,
                      reactivate: form.get("reactivate") === "on",
                    }),
                  });
                  setMessage("Solicitud registrada");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block">
                Avísame cuando vuelva
                <input
                  className="block w-full border p-3"
                  name="email"
                  type="email"
                  placeholder="Tu correo"
                  required
                />
              </label>
              <label className="block text-sm">
                <input name="reactivate" type="checkbox" /> Reactivar mis avisos
                si antes me di de baja
              </label>
              <button disabled={busy} className="shop-button">
                Recibir aviso
              </button>
            </form>
          ) : (
            <p>No hay variantes disponibles.</p>
          )}
          <p role="status">{message}</p>
          <h2 className="text-xl">Materiales</h2>
          <p>{p.materials}</p>
          <h2 className="text-xl">Especificaciones</h2>
          <p>{p.specifications}</p>
          <h2 className="text-xl">Guía de tallas · cm</h2>
          <table className="w-full text-left">
            <thead>
              <tr>
                {["Talla", "Pecho", "Cintura", "Cadera"].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.measurements.map((m) => (
                <tr key={m.size}>
                  <td>{m.size}</td>
                  <td>{m.chestCm || "—"}</td>
                  <td>{m.waistCm || "—"}</td>
                  <td>{m.hipCm || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.modelHeightCm && (
            <p>
              Modelo: {p.modelHeightCm} cm · Talla {p.modelSize || "—"}
            </p>
          )}
        </section>
      </div>
      {!!p.complements?.length && (
        <section className="mt-14">
          <h2 className="font-display text-3xl">Completa el look</h2>
          <div className="mt-5 flex flex-wrap gap-6">
            {p.complements.map(({ complementary: c }) => (
              <Link className="w-48" key={c.id} href={"/productos/" + c.slug}>
                <div className="relative aspect-[4/5]">
                  <Image
                    unoptimized
                    fill
                    className="object-cover"
                    src={c.images[0]?.url || "/images/hero-editorial.svg"}
                    alt={c.name}
                  />
                </div>
                <p>{c.name}</p>
                <p>{formatPrice(Number(c.salePrice))}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
