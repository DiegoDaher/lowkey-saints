"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { prepareProductImage } from "@/lib/prepare-product-image";

export type ProductPhoto = { path: string; url: string; alt: string };
type Uploaded = ProductPhoto & { id: string; expiresAt: string };
type Item = {
  key: string;
  photo?: ProductPhoto;
  uploadId?: string;
  file?: File;
  preview?: string;
  status: "pending" | "processing" | "uploading" | "done" | "error";
  error?: string;
};
type Call = <T>(path: string, options?: RequestInit) => Promise<T>;
const labels = {
  pending: "Pendiente",
  processing: "Procesando",
  uploading: "Subiendo",
  done: "Completado",
  error: "Error",
};

export default function ProductMediaEditor({
  initialImages,
  name,
  call,
  disabled,
  onChange,
  onState,
}: {
  initialImages: ProductPhoto[];
  name: string;
  call: Call;
  disabled: boolean;
  onChange: (images: ProductPhoto[]) => void;
  onState: (uploading: boolean, unresolved: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initialImages.map((photo) => ({ key: photo.path, photo, status: "done" }))
  );
  const current = useRef(items);
  const running = useRef(false);
  const [active, setActive] = useState(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const previews = useRef(new Set<string>());
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const urls = previews.current;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);
  function publish(next: Item[]) {
    if (!mounted.current) return;
    current.current = next;
    setItems(next);
    onChange(next.flatMap((item) => (item.photo ? [item.photo] : [])));
    onState(
      running.current,
      next.some((item) => item.status !== "done")
    );
  }
  function patch(key: string, change: Partial<Item>) {
    publish(
      current.current.map((item) =>
        item.key === key ? { ...item, ...change } : item
      )
    );
  }
  async function process(batch: Item[]) {
    if (running.current || disabled) return;
    running.current = true;
    setActive(true);
    onState(true, true);
    controller.current = new AbortController();
    for (const item of batch) {
      if (!mounted.current) break;
      try {
        patch(item.key, { status: "processing", error: undefined });
        const blob = await prepareProductImage(item.file!);
        if (!mounted.current) break;
        const preview = URL.createObjectURL(blob);
        previews.current.add(preview);
        const previous = current.current.find(
          (v) => v.key === item.key
        )?.preview;
        if (previous) {
          URL.revokeObjectURL(previous);
          previews.current.delete(previous);
        }
        patch(item.key, { status: "uploading", preview });
        const uploaded = await call<Uploaded>("/admin/images", {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
          signal: controller.current.signal,
        });
        patch(item.key, {
          status: "done",
          uploadId: uploaded.id,
          photo: {
            path: uploaded.path,
            url: uploaded.url,
            alt: (name || item.file!.name).slice(0, 200),
          },
          file: undefined,
        });
      } catch (error) {
        if (mounted.current)
          patch(item.key, {
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "No se pudo procesar la imagen",
          });
      }
    }
    running.current = false;
    if (mounted.current) {
      setActive(false);
      onState(
        false,
        current.current.some((item) => item.status !== "done")
      );
    }
  }
  function add(files: File[]) {
    if (running.current || disabled || !files.length) return;
    if (current.current.length + files.length > 12) {
      setMessage("Máximo 12 fotografías, incluidas las pendientes");
      return;
    }
    setMessage("");
    const batch: Item[] = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "pending",
    }));
    publish([...current.current, ...batch]);
    void process(batch);
  }
  function remove(item: Item) {
    if (running.current || disabled) return;
    publish(current.current.filter((v) => v.key !== item.key));
    if (item.preview) {
      URL.revokeObjectURL(item.preview);
      previews.current.delete(item.preview);
    }
    if (item.uploadId)
      void call("/admin/images/" + item.uploadId, { method: "DELETE" }).catch(
        () => {
          if (mounted.current)
            setMessage(
              "La foto se quitó del borrador. Su limpieza se reintentará al caducar."
            );
        }
      );
  }
  const blocked = disabled || active;
  return (
    <section aria-label="Fotografías del producto" className="space-y-3">
      <div
        className={`border border-dashed p-4 ${dragging ? "bg-stone-200" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!blocked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(Array.from(e.dataTransfer.files));
        }}
      >
        <label>
          Fotografías: selecciona o arrastra archivos
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={blocked || items.length >= 12}
            onChange={(e) => {
              add(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
        <p>
          Máximo 12. JPG, PNG o WebP de hasta 15 MiB. La primera será la
          portada.
        </p>
        <p>Las fotos nuevas sin guardar caducan en 24 horas.</p>
      </div>
      <p role="alert">{message}</p>
      <p role="status" aria-live="polite">
        {items.filter((v) => v.status === "done").length} de {items.length}{" "}
        fotografías listas
      </p>
      <div className="flex flex-wrap gap-4">
        {items.map((item, i) => (
          <div className="w-40 space-y-2" key={item.key}>
            {(item.preview || item.photo) && (
              <div className="relative h-40">
                <Image
                  unoptimized
                  fill
                  sizes="160px"
                  className="object-cover"
                  src={item.preview || item.photo!.url}
                  alt={item.photo?.alt || item.file?.name || "Vista previa"}
                />
              </div>
            )}
            <p className="break-words">{item.file?.name}</p>
            <p role="status">
              {labels[item.status]}
              {i === 0 ? " · Portada" : ""}
            </p>
            {item.error && <p role="alert">{item.error}</p>}
            {item.photo && (
              <input
                aria-label={`Descripción de la foto ${i + 1}`}
                maxLength={200}
                disabled={blocked}
                value={item.photo.alt}
                onChange={(e) =>
                  patch(item.key, {
                    photo: { ...item.photo!, alt: e.target.value },
                  })
                }
              />
            )}
            {item.status === "error" && (
              <button
                type="button"
                disabled={blocked}
                onClick={() => void process([item])}
              >
                Reintentar
              </button>
            )}
            <button
              type="button"
              disabled={blocked || i === 0}
              onClick={() => {
                const next = [...current.current];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                publish(next);
              }}
            >
              ← Mover
            </button>
            <button
              type="button"
              disabled={blocked}
              className="ml-2 underline"
              onClick={() => remove(item)}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
