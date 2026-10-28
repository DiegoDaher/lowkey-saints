"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import type {
  CatalogProduct,
  ProductInput,
} from "../../../supabase/functions/_shared/contracts";
type Call = <T>(path: string, options?: RequestInit) => Promise<T>;
export default function ProductEditor({
  product: p,
  categories,
  call,
  onClose,
  onSaved,
}: {
  product: CatalogProduct | null;
  categories: { id: string; name: string }[];
  call: Call;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [images, setImages] = useState(
    p?.images.map((i) => ({ path: i.path, alt: i.alt, url: i.url })) || []
  );
  const [measurements, setMeasurements] = useState(
    p?.measurements.map((m) => ({ ...m })) || []
  );
  const [complements, setComplements] = useState<string[]>([]);
  const [options, setOptions] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    call<{ items: CatalogProduct[] }>(
      "/admin/products?q=" + encodeURIComponent(search)
    )
      .then((r) => setOptions(r.items))
      .catch((e) => setError(e.message));
  }, [call, search]);
  useEffect(() => {
    if (p)
      call<CatalogProduct>("/admin/products/" + p.id)
        .then((v) =>
          setComplements(v.complements?.map((c) => c.complementary.id) || [])
        )
        .catch((e) => setError(e.message));
  }, [call, p]);
  async function upload(files: FileList | null) {
    if (!files) return;
    if (images.length + files.length > 12) {
      setError("Máximo 12 fotografías");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 15 * 1024 * 1024
        )
          throw new Error("Usa imágenes JPG, PNG o WebP de hasta 15 MB");
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas
          .getContext("2d")!
          .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b
                ? resolve(b)
                : reject(new Error("No se pudo procesar la imagen")),
            "image/webp",
            0.85
          )
        );
        const im = await call<{ path: string; url: string }>("/admin/images", {
          method: "POST",
          headers: { "Content-Type": "image/webp" },
          body: blob,
        });
        setImages((old) => [...old, { ...im, alt: p?.name || file.name }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5 border bg-stone-50 p-6">
      <div className="flex justify-between">
        <h2 className="text-2xl">{p ? "Editar producto" : "Nuevo producto"}</h2>
        <button onClick={onClose} disabled={busy}>
          Cerrar
        </button>
      </div>
      <p role="alert">{error}</p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const input: ProductInput = {
              name: String(f.get("name")),
              slug: String(f.get("slug")),
              description: String(f.get("description")),
              materials: String(f.get("materials")),
              specifications: String(f.get("specifications")),
              salePrice: String(f.get("salePrice")),
              isArchived: f.get("archived") === "on",
              version: p?.version,
              modelHeightCm: String(f.get("height")) || null,
              modelSize: String(f.get("modelSize")) || null,
              categoryIds: f.getAll("category").map(String),
              images: images.map(({ path, alt }) => ({ path, alt })),
              measurements: measurements.map((m) => ({
                size: m.size,
                chestCm: m.chestCm || null,
                waistCm: m.waistCm || null,
                hipCm: m.hipCm || null,
              })),
              complementaryIds: complements,
            };
            await call("/admin/products" + (p ? "/" + p.id : ""), {
              method: p ? "PUT" : "POST",
              body: JSON.stringify(input),
            });
            await onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            Nombre
            <input name="name" required defaultValue={p?.name} />
          </label>
          <label>
            Dirección del producto
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="camiseta-esencial"
              defaultValue={p?.slug}
            />
          </label>
          <label>
            Precio de venta MXN
            <input
              name="salePrice"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={p?.salePrice}
            />
          </label>
          <label>
            <input
              name="archived"
              type="checkbox"
              defaultChecked={p?.isArchived}
            />{" "}
            Archivar producto
          </label>
        </div>
        <label>
          Descripción
          <textarea name="description" rows={3} defaultValue={p?.description} />
        </label>
        <label>
          Materiales
          <textarea name="materials" defaultValue={p?.materials} />
        </label>
        <label>
          Especificaciones
          <textarea name="specifications" defaultValue={p?.specifications} />
        </label>
        <fieldset>
          <legend>Categorías</legend>
          <div className="flex flex-wrap gap-5">
            {categories.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  name="category"
                  value={c.id}
                  defaultChecked={p?.categories.some(
                    (x) => x.category.id === c.id
                  )}
                />{" "}
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files);
          }}
          className="border border-dashed p-4"
        >
          <label>
            Fotografías: selecciona o arrastra archivos
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || images.length >= 12}
              onChange={(e) => void upload(e.target.files)}
            />
          </label>
          <p>Máximo 12. La primera imagen será la portada.</p>
          <div className="flex flex-wrap gap-4">
            {images.map((im, i) => (
              <div className="w-36 space-y-2" key={im.path}>
                <div className="relative h-40">
                  <Image
                    unoptimized
                    fill
                    className="object-cover"
                    src={im.url}
                    alt={im.alt}
                  />
                </div>
                <input
                  aria-label="Descripción de la foto"
                  value={im.alt}
                  onChange={(e) =>
                    setImages((old) =>
                      old.map((v, n) =>
                        n === i ? { ...v, alt: e.target.value } : v
                      )
                    )
                  }
                />
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() =>
                    setImages((old) => {
                      const next = [...old];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      return next;
                    })
                  }
                >
                  ← Mover
                </button>
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() =>
                    setImages((old) => old.filter((_, n) => n !== i))
                  }
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
        <fieldset>
          <legend>Medidas por talla (cm)</legend>
          {measurements.map((m, i) => (
            <div className="grid grid-cols-5 gap-2" key={i}>
              {(["size", "chestCm", "waistCm", "hipCm"] as const).map(
                (field, n) => (
                  <label key={field}>
                    {["Talla", "Pecho", "Cintura", "Cadera"][n]}
                    <input
                      value={m[field] || ""}
                      type={field === "size" ? "text" : "number"}
                      min="0.01"
                      step="0.01"
                      required={field === "size"}
                      onChange={(e) =>
                        setMeasurements((old) =>
                          old.map((v, j) =>
                            j === i ? { ...v, [field]: e.target.value } : v
                          )
                        )
                      }
                    />
                  </label>
                )
              )}
              <button
                type="button"
                onClick={() =>
                  setMeasurements((old) => old.filter((_, j) => j !== i))
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            className="underline"
            onClick={() =>
              setMeasurements((old) => [
                ...old,
                { size: "", chestCm: null, waistCm: null, hipCm: null },
              ])
            }
          >
            Agregar talla
          </button>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            Estatura del modelo (cm)
            <input
              name="height"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={p?.modelHeightCm || ""}
            />
          </label>
          <label>
            Talla usada por el modelo
            <input name="modelSize" defaultValue={p?.modelSize || ""} />
          </label>
        </div>
        <fieldset>
          <legend>Completa el look (máximo 3)</legend>
          <label>
            Buscar productos
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <p>{complements.length} seleccionados</p>
          {options
            .filter((o) => o.id !== p?.id)
            .map((o) => (
              <label key={o.id}>
                <input
                  type="checkbox"
                  checked={complements.includes(o.id)}
                  disabled={
                    !complements.includes(o.id) && complements.length >= 3
                  }
                  onChange={(e) =>
                    setComplements((old) =>
                      e.target.checked
                        ? [...old, o.id]
                        : old.filter((id) => id !== o.id)
                    )
                  }
                />{" "}
                {o.name}
              </label>
            ))}
        </fieldset>
        <button disabled={busy} className="shop-button">
          {busy ? "Guardando…" : "Guardar producto"}
        </button>
      </form>
    </section>
  );
}
