"use client";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import ProductImage from "@/components/catalog/ProductImage";
import { formatCents } from "@/lib/format-price";
import {
  lineLimit,
  lineTotal,
  type CartLine,
} from "@/modules/orders/domain/cart";

interface CartItemRowProps {
  line: CartLine;
  disabled?: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onNavigate?: () => void;
}

export default function CartItemRow({
  line,
  disabled,
  onQuantity,
  onRemove,
  onNavigate,
}: CartItemRowProps) {
  const limit = lineLimit(line);
  const atLimit = line.quantity >= limit;
  const label = `${line.name}, talla ${line.size}, ${line.color}`;
  const name = line.slug ? (
    <Link
      className="store-link font-semibold"
      href={"/productos/" + line.slug}
      onNavigate={onNavigate}
    >
      {line.name}
    </Link>
  ) : (
    <span className="font-semibold">{line.name}</span>
  );

  return (
    <li className="store-cart-row border-line flex gap-4 border-b py-4 last:border-0">
      <div className="store-card-media relative aspect-[4/5] w-20 shrink-0 overflow-hidden">
        {line.image ? (
          <ProductImage sizes="80px" src={line.image} alt="" />
        ) : (
          <div className="text-muted flex h-full items-center justify-center">
            <ShoppingBag aria-hidden="true" size={22} strokeWidth={1.4} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {name}
            <p className="text-muted text-sm">
              {line.size} / {line.color} · {formatCents(line.priceCents)}
            </p>
          </div>
          <p className="shrink-0 font-semibold" aria-label="Total de línea">
            {formatCents(lineTotal(line))}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="store-stepper flex items-center"
            role="group"
            aria-label={`Cantidad de ${label}`}
          >
            <button
              type="button"
              className="store-icon flex size-11 items-center justify-center"
              aria-label={
                line.quantity === 1
                  ? `Quitar ${label}`
                  : `Disminuir cantidad de ${label}`
              }
              disabled={disabled}
              onClick={() => onQuantity(line.quantity - 1)}
            >
              <Minus aria-hidden="true" size={16} />
            </button>
            <span
              className="min-w-8 text-center tabular-nums"
              aria-live="polite"
            >
              {line.quantity}
            </span>
            <button
              type="button"
              className="store-icon flex size-11 items-center justify-center"
              aria-label={`Aumentar cantidad de ${label}`}
              disabled={disabled || atLimit}
              onClick={() => onQuantity(line.quantity + 1)}
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
          {atLimit && (
            <span className="text-muted text-xs">Máximo disponible</span>
          )}
          <button
            type="button"
            className="store-link inline-flex min-h-11 items-center gap-1 text-sm"
            aria-label={`Quitar ${label} de la bolsa`}
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" size={14} />
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}
