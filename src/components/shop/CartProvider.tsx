"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  addLine,
  emptyCart,
  itemCount,
  migrateLegacy,
  parseCartState,
  removeLine,
  setQuantity as setLineQuantity,
  subtotalCents,
  type CartLine,
  type CartState,
} from "@/modules/orders/domain/cart";

export type { CartLine };

export const CART_KEY = "cart-storage";
const LEGACY_KEY = "lowkey-cart";
const EVENT = "cart-storage";

let cached: CartState = emptyCart;
let raw: string | null = null;

function read(): string | null {
  const current = localStorage.getItem(CART_KEY);
  if (current !== null) return current;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === null) return null;
  // One-time migration from the pre-PDP-04 storage format.
  const migrated = JSON.stringify(migrateLegacy(legacy, Date.now()));
  localStorage.setItem(CART_KEY, migrated);
  localStorage.removeItem(LEGACY_KEY);
  return migrated;
}

function snapshot(): CartState {
  const next = read();
  if (next !== raw) {
    raw = next;
    cached = parseCartState(next);
  }
  return cached;
}

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(EVENT, notify);
  };
}

function update(fn: (state: CartState) => CartState) {
  localStorage.setItem(CART_KEY, JSON.stringify(fn(snapshot())));
  window.dispatchEvent(new Event(EVENT));
}

interface CartContext {
  items: CartLine[];
  heldAt: number | null;
  count: number;
  subtotalCents: number;
  add: (line: Omit<CartLine, "quantity">, options?: { open?: boolean }) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const Context = createContext<CartContext | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => emptyCart);
  const [isOpen, setOpen] = useState(false);
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  const value = useMemo<CartContext>(
    () => ({
      items: state.items,
      heldAt: state.heldAt,
      count: itemCount(state.items),
      subtotalCents: subtotalCents(state.items),
      add: (line, { open = true } = {}) => {
        update((s) => addLine(s, line, Date.now()));
        if (open) setOpen(true);
      },
      setQuantity: (id, n) => update((s) => setLineQuantity(s, id, n)),
      remove: (id) => update((s) => removeLine(s, id)),
      clear: () => update(() => emptyCart),
      isOpen,
      openCart,
      closeCart,
    }),
    [state, isOpen, openCart, closeCart]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCart() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing cart provider");
  return ctx;
}
