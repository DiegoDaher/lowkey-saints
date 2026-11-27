"use client";
import type { KeyboardEvent } from "react";
import { checkStock } from "@/modules/inventory/application/CheckStockUseCase";

type Variant = {
  id: string;
  size: string;
  color: string;
  colorHex?: string | null;
  stock: number;
  isArchived?: boolean;
};

const unique = (xs: string[]) => [...new Set(xs)];
const KEYS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];

/** Arrow/Home/End move focus and selection inside one group (roving tabindex). */
function onGroupKeyDown(e: KeyboardEvent<HTMLDivElement>) {
  if (!KEYS.includes(e.key)) return;
  const items = [
    ...e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
  const next =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? items.length - 1
        : (i + step + items.length) % items.length;
  items[next].focus();
  items[next].click();
}

export default function VariantSelector({
  variants: all,
  selectedId,
  onSelect,
}: {
  variants: Variant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const variants = all.filter((v) => !v.isArchived);
  const current = variants.find((v) => v.id === selectedId);
  const find = (size: string, color: string) =>
    variants.find((v) => v.size === size && v.color === color);
  const buyable = (v: Variant) => checkStock(v).canPurchase;

  const pick = (axis: "size" | "color", value: string) => {
    if (!current) return;
    const size = axis === "size" ? value : current.size;
    const color = axis === "color" ? value : current.color;
    const exact = find(size, color);
    if (exact) return onSelect(exact.id);
    // Combination doesn't exist: keep the new choice, prefer an in-stock variant.
    const candidates = variants.filter((v) => v[axis] === value);
    const best = candidates.find(buyable) ?? candidates[0];
    if (best) onSelect(best.id);
  };

  const isOut = (axis: "size" | "color", value: string) => {
    const v =
      current &&
      (axis === "size"
        ? find(value, current.color)
        : find(current.size, value));
    return v
      ? !buyable(v)
      : !variants.some((x) => x[axis] === value && buyable(x));
  };

  return (
    <div className="space-y-5">
      <div
        role="group"
        aria-labelledby="variant-size-label"
        onKeyDown={onGroupKeyDown}
      >
        <p id="variant-size-label" className="mb-2">
          Talla{current ? `: ${current.size}` : ""}
        </p>
        <div className="-mx-1 flex flex-wrap gap-2 p-1">
          {unique(variants.map((v) => v.size)).map((size) => {
            const out = isOut("size", size);
            const selected = current?.size === size;
            return (
              <button
                key={size}
                type="button"
                tabIndex={selected ? 0 : -1}
                aria-pressed={selected}
                aria-label={`Talla ${size}${out ? ", agotado" : ""}`}
                onClick={() => pick("size", size)}
                className={`store-choice border-line min-h-11 min-w-11 border px-3 ${
                  out ? "store-choice--out" : ""
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>
      <div
        role="group"
        aria-labelledby="variant-color-label"
        onKeyDown={onGroupKeyDown}
      >
        <p id="variant-color-label" className="mb-2">
          Color{current ? `: ${current.color}` : ""}
        </p>
        <div className="-mx-1 flex flex-wrap gap-3 p-1">
          {unique(variants.map((v) => v.color)).map((color) => {
            const out = isOut("color", color);
            const hex = variants.find((x) => x.color === color)?.colorHex;
            const selected = current?.color === color;
            return (
              <button
                key={color}
                type="button"
                tabIndex={selected ? 0 : -1}
                aria-pressed={selected}
                aria-label={`Color ${color}${out ? ", agotado" : ""}`}
                title={color}
                onClick={() => pick("color", color)}
                style={hex ? { backgroundColor: hex } : undefined}
                className={`store-choice store-swatch border-ink/25 size-11 rounded-full border-2 ${
                  out ? "store-swatch--out" : ""
                }`}
              >
                {!hex && <span className="text-xs">{color}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
