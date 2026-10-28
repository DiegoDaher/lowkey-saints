"use client";
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
export interface CartLine {
  variantId: string;
  name: string;
  size: string;
  color: string;
  price: string;
  quantity: number;
}
const empty: CartLine[] = [];
let cached: CartLine[] = empty;
let raw: string | null = null;
function snapshot() {
  const next = localStorage.getItem("lowkey-cart");
  if (next !== raw) {
    raw = next;
    try {
      const value = JSON.parse(next || "[]");
      cached = Array.isArray(value)
        ? value.filter(
            (x) =>
              typeof x.variantId === "string" &&
              typeof x.name === "string" &&
              typeof x.price === "string" &&
              Number.isInteger(x.quantity) &&
              x.quantity > 0 &&
              x.quantity <= 20
          )
        : empty;
    } catch {
      cached = empty;
    }
  }
  return cached;
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("lowkey-cart", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("lowkey-cart", notify);
  };
}
function update(fn: (items: CartLine[]) => CartLine[]) {
  localStorage.setItem("lowkey-cart", JSON.stringify(fn(snapshot())));
  window.dispatchEvent(new Event("lowkey-cart"));
}
const Context = createContext<{
  items: CartLine[];
  add: (line: Omit<CartLine, "quantity">) => void;
  quantity: (id: string, n: number) => void;
  clear: () => void;
} | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, snapshot, () => empty);
  return (
    <Context.Provider
      value={{
        items,
        add: (line) =>
          update((old) =>
            old.some((i) => i.variantId === line.variantId)
              ? old.map((i) =>
                  i.variantId === line.variantId
                    ? { ...i, quantity: Math.min(20, i.quantity + 1) }
                    : i
                )
              : [...old, { ...line, quantity: 1 }]
          ),
        quantity: (id, n) =>
          update((old) =>
            old
              .map((i) =>
                i.variantId === id ? { ...i, quantity: Math.min(20, n) } : i
              )
              .filter((i) => i.quantity > 0)
          ),
        clear: () => update(() => []),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCart() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing cart provider");
  return ctx;
}
