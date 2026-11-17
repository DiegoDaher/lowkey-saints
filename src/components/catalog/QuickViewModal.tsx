"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import ProductImage from "@/components/catalog/ProductImage";
import Link from "next/link";
import { formatPrice } from "@/lib/format-price";
import type { Product } from "@/types/product";

interface QuickViewModalProps {
  onClose: () => void;
  product: Product;
}

export default function QuickViewModal({
  onClose,
  product,
}: QuickViewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedImage, setSelectedImage] = useState(product.images.primary);
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product.colors?.[0]?.name
  );
  const galleryImages = [
    product.images.primary,
    ...(product.images.gallery ?? []),
    ...(product.images.alternate ? [product.images.alternate] : []),
  ].filter((image, index, images) => images.indexOf(image) === index);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      aria-labelledby="quick-view-title"
      aria-modal="true"
      className="quick-view-dialog bg-paper text-ink backdrop:bg-ink/55 fixed inset-x-0 bottom-0 m-0 max-h-[94svh] w-full max-w-none overflow-y-auto p-0 md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[88svh] md:w-[min(92vw,72rem)] md:-translate-x-1/2 md:-translate-y-1/2"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      ref={dialogRef}
    >
      <div className="pointer-events-none sticky top-3 z-20 flex h-0 justify-end px-3">
        <button
          aria-label="Cerrar vista rápida"
          className="store-icon bg-paper pointer-events-auto flex size-11 items-center justify-center"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={22} />
        </button>
      </div>

      <div className="grid md:min-h-[34rem] md:grid-cols-2">
        <div className="p-4 pt-14 sm:p-6 sm:pt-14 md:p-8">
          <div className="store-card-media relative aspect-[4/5] overflow-hidden">
            <ProductImage
              unoptimized
              alt={product.name}
              className="object-contain"
              sizes="(max-width: 767px) 100vw, 46vw"
              src={selectedImage}
            />
          </div>
          {galleryImages.length > 1 && (
            <div
              aria-label="Galería de producto"
              className="mt-3 flex gap-2 overflow-x-auto"
            >
              {galleryImages.map((image, index) => (
                <button
                  aria-label={`Ver imagen ${index + 1} de ${product.name}`}
                  aria-pressed={selectedImage === image}
                  className={`store-choice relative h-20 w-16 shrink-0 overflow-hidden border ${
                    selectedImage === image
                      ? "border-ink"
                      : "border-transparent"
                  }`}
                  key={image}
                  onClick={() => setSelectedImage(image)}
                  type="button"
                >
                  <ProductImage
                    unoptimized
                    alt=""
                    className="object-contain"
                    sizes="64px"
                    src={image}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col p-5 sm:p-8 md:justify-center md:p-10 lg:p-14">
          <p className="text-muted mb-3 text-[0.65rem] font-semibold tracking-[0.17em] uppercase">
            {product.category}
          </p>
          <h2
            className="font-display text-3xl leading-tight font-bold tracking-[0.04em] uppercase sm:text-4xl"
            id="quick-view-title"
          >
            {product.name}
          </h2>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-medium">{formatPrice(product.price)}</span>
            {product.compareAtPrice &&
              product.compareAtPrice > product.price && (
                <span className="text-sale text-sm line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
          </div>
          {product.description && (
            <p className="text-muted mt-5 text-sm leading-6">
              {product.description}
            </p>
          )}

          {product.colors && product.colors.length > 0 && (
            <fieldset className="mt-7">
              <legend className="mb-3 text-xs font-semibold tracking-[0.1em] uppercase">
                Color
                {selectedColor && (
                  <span className="text-muted ml-2 font-normal tracking-normal normal-case">
                    {selectedColor}
                  </span>
                )}
              </legend>
              <div className="flex flex-wrap gap-3">
                {product.colors.map((color) => (
                  <button
                    aria-label={color.name}
                    aria-pressed={selectedColor === color.name}
                    className={`store-choice store-swatch size-11 rounded-full border-2 ${
                      selectedColor === color.name
                        ? "border-ink outline-gold outline outline-1 outline-offset-2"
                        : "border-ink/15"
                    }`}
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    style={{ backgroundColor: color.hex }}
                    type="button"
                  />
                ))}
              </div>
            </fieldset>
          )}

          {product.sizes && product.sizes.length > 0 && (
            <fieldset className="mt-7">
              <legend className="mb-3 text-xs font-semibold tracking-[0.1em] uppercase">
                Talla
                {selectedSize && (
                  <span className="text-muted ml-2 font-normal tracking-normal normal-case">
                    {selectedSize}
                  </span>
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    aria-pressed={selectedSize === size}
                    className={`store-choice min-h-11 min-w-11 border px-3 text-xs transition-colors ${
                      selectedSize === size
                        ? "border-ink bg-ink text-paper"
                        : "border-line"
                    }`}
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    type="button"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <Link
            className="store-link mt-5 inline-flex min-h-11 items-center self-center text-center text-xs font-semibold tracking-[0.1em]"
            href={`/productos/${product.slug}`}
            onClick={onClose}
          >
            VER DETALLES
          </Link>
        </div>
      </div>
    </dialog>
  );
}
