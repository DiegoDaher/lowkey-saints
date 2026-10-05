"use client";

import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import {
  useCatalogFilters,
  type ProductCategory,
} from "@/components/catalog/CatalogFilterProvider";

const categories: { label: string; value: ProductCategory }[] = [
  { label: "Tops", value: "Tops" },
  { label: "Pantalones", value: "Pantalones" },
  { label: "Accesorios", value: "Accesorios" },
  { label: "Drops", value: "Drops" },
];

export default function Header() {
  const { filters, setCategory } = useCatalogFilters();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const menuPanel = menuPanelRef.current;
    const focusableElements = menuPanel?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])"
    );
    focusableElements?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function selectCategory(category: ProductCategory) {
    setCategory(category);
    setMenuOpen(false);
  }

  return (
    <header className="border-line bg-paper sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between px-4 sm:px-8 lg:h-20 lg:px-12">
        <button
          ref={menuButtonRef}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-controls="mobile-category-navigation"
          className="flex size-11 items-center justify-center lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          type="button"
        >
          {menuOpen ? (
            <X aria-hidden="true" size={22} />
          ) : (
            <Menu aria-hidden="true" size={22} />
          )}
        </button>

        <div className="hidden min-w-11 lg:block" aria-hidden="true" />
        <Logo />

        <nav aria-label="Categorías principales" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {categories.map((category) => (
              <li key={category.label}>
                <Link
                  aria-current={
                    filters.category === category.value ? "true" : undefined
                  }
                  className="font-display hover:text-muted text-sm font-semibold tracking-[0.12em] transition-colors"
                  href="#catalogo"
                  onClick={() => selectCategory(category.value)}
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-11 items-center justify-end gap-1">
          <button
            aria-label="Buscar (próximamente)"
            className="flex size-11 items-center justify-center"
            type="button"
          >
            <Search aria-hidden="true" size={20} strokeWidth={1.6} />
          </button>
          <button
            aria-label="Bolsa (próximamente)"
            className="flex size-11 items-center justify-center"
            type="button"
          >
            <ShoppingBag aria-hidden="true" size={20} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          ref={menuPanelRef}
          className="border-line bg-paper absolute inset-x-0 top-full border-b px-6 pt-5 pb-8 shadow-sm lg:hidden"
          id="mobile-category-navigation"
        >
          <nav aria-label="Categorías móviles">
            <ul className="flex flex-col">
              {categories.map((category) => (
                <li
                  className="border-line border-b last:border-0"
                  key={category.label}
                >
                  <Link
                    aria-current={
                      filters.category === category.value ? "true" : undefined
                    }
                    className="font-display block py-4 text-xl font-semibold tracking-[0.1em]"
                    href="#catalogo"
                    onClick={() => selectCategory(category.value)}
                  >
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
