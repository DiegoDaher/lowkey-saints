"use client";
import { useState } from "react";
import Link from "next/link";
import ProductImage from "@/components/catalog/ProductImage";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";
import { useCart } from "./CartProvider";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format-price";
import StoreAction from "@/components/ui/StoreAction";
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
      <Link
        className="store-link inline-flex min-h-11 items-center"
        href="/#catalogo"
      >
        ← Catálogo
      </Link>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div className="min-w-0">
          <div className="store-card-media relative aspect-[4/5] overflow-hidden">
            <ProductImage
              unoptimized
              className="object-contain"
              sizes="(max-width: 767px) 100vw, 50vw"
              src={p.images[image]?.url || "/images/hero-editorial.svg"}
              alt={p.images[image]?.alt || p.name}
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto p-1">
            {p.images.map((im, i) => (
              <button
                aria-label={"Ver imagen " + (i + 1)}
                aria-pressed={image === i}
                key={im.id}
                onClick={() => setImage(i)}
                className="store-choice border-line relative h-20 w-16 shrink-0 border"
              >
                <ProductImage
                  unoptimized
                  className="object-contain"
                  sizes="64px"
                  src={im.url}
                  alt={im.alt}
                />
              </button>
            ))}
          </div>
        </div>
        <section className="min-w-0 space-y-6">
          <p>{p.categories.map((c) => c.category.name).join(" / ")}</p>
          <h1 className="font-display text-5xl uppercase">{p.name}</h1>
          <p className="text-xl">{formatPrice(Number(p.salePrice))}</p>
          <p>{p.description}</p>
          <label className="block">
            Talla y color
            <select
              className="store-field mt-2 block w-full border p-3"
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
              <StoreAction
                className="w-full sm:w-auto"
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
              </StoreAction>
              <Link
                className="store-link mt-3 inline-flex min-h-11 items-center sm:mt-0 sm:ml-5"
                href="/bolsa"
              >
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
                  className="store-field block w-full border p-3"
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
              <StoreAction type="submit" disabled={busy} aria-busy={busy}>
                {busy ? "Registrando…" : "Recibir aviso"}
              </StoreAction>
            </form>
          ) : (
            <p>No hay variantes disponibles.</p>
          )}
          <p className="store-status" role="status">
            {message}
          </p>
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
              <Link
                className="product-card store-product-card block w-48"
                key={c.id}
                href={"/productos/" + c.slug}
              >
                <div className="store-card-media relative aspect-[4/5] overflow-hidden">
                  <ProductImage
                    unoptimized
                    className="product-card__primary store-product-image"
                    sizes="192px"
                    src={c.images[0]?.url || "/images/hero-editorial.svg"}
                    alt={c.name}
                  />
                  {c.images[1] && (
                    <ProductImage
                      className="product-card__alternate store-product-image"
                      sizes="192px"
                      src={c.images[1].url}
                      alt={`${c.name}, vista alternativa`}
                    />
                  )}
                </div>
                <p className="store-product-name store-link mt-3">{c.name}</p>
                <p>{formatPrice(Number(c.salePrice))}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
