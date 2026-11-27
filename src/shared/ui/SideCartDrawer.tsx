"use client";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useCart } from "@/components/shop/CartProvider";
import StoreAction from "@/components/ui/StoreAction";
import { formatCents } from "@/lib/format-price";
import CartItemRow from "@/modules/orders/ui/components/CartItemRow";
import HoldNotice from "@/modules/orders/ui/components/HoldNotice";

/** Global side-cart. Mounted once in the storefront shell. */
export default function SideCartDrawer() {
  const cart = useCart();
  const { isOpen, closeCart } = cart;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    // html keeps `scrollbar-gutter: stable`, so locking does not shift layout.
    root.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      root.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="side-cart-title"
      className="side-cart bg-paper text-ink m-0 p-0"
      onCancel={(event) => {
        event.preventDefault();
        closeCart();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) closeCart();
      }}
    >
      {isOpen && (
        <div className="flex h-full flex-col">
          <div className="border-line flex items-center justify-between border-b px-5 py-3">
            <h2
              id="side-cart-title"
              className="font-display text-2xl font-semibold uppercase"
            >
              Tu bolsa{cart.count > 0 && ` (${cart.count})`}
            </h2>
            <button
              ref={closeRef}
              type="button"
              aria-label="Cerrar bolsa"
              className="store-icon flex size-11 items-center justify-center"
              onClick={closeCart}
            >
              <X aria-hidden="true" size={22} />
            </button>
          </div>

          {cart.items.length ? (
            <>
              <div className="flex-1 overflow-y-auto overscroll-contain px-5">
                <div className="pt-4">
                  <HoldNotice heldAt={cart.heldAt} />
                </div>
                <ul aria-label="Artículos en tu bolsa">
                  {cart.items.map((line) => (
                    <CartItemRow
                      key={line.variantId}
                      line={line}
                      onQuantity={(n) => cart.setQuantity(line.variantId, n)}
                      onRemove={() => cart.remove(line.variantId)}
                      onNavigate={closeCart}
                    />
                  ))}
                </ul>
              </div>
              <div className="border-line bg-bone space-y-3 border-t px-5 py-4">
                <p className="flex items-baseline justify-between text-lg">
                  <span>Subtotal</span>
                  <strong data-testid="side-cart-subtotal">
                    {formatCents(cart.subtotalCents)}
                  </strong>
                </p>
                <p className="text-muted text-xs">
                  El precio y la disponibilidad se confirman al crear tu pedido.
                </p>
                <StoreAction
                  href="/bolsa"
                  className="w-full"
                  onNavigate={closeCart}
                >
                  Finalizar pedido
                </StoreAction>
                <button
                  type="button"
                  className="store-link inline-flex min-h-11 w-full items-center justify-center"
                  onClick={closeCart}
                >
                  Seguir comprando
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
              <p>Tu bolsa está vacía.</p>
              <StoreAction href="/#catalogo" onNavigate={closeCart}>
                Ver catálogo
              </StoreAction>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
