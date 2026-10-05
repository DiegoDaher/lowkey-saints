"use client";

import { useRef, useState } from "react";
import QuickViewModal from "@/components/catalog/QuickViewModal";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/catalog/ProductCard";
import type { Product } from "@/types/product";

interface ProductGridProps {
  products: Product[];
}

interface ProductGridSkeletonProps {
  count?: number;
}

export default function ProductGrid({ products }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function openQuickView(product: Product, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setSelectedProduct(product);
  }

  function closeQuickView() {
    setSelectedProduct(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (products.length === 0) {
    return (
      <p className="text-muted py-20 text-center text-sm">
        No hay productos disponibles
      </p>
    );
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:mt-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            onQuickView={openQuickView}
            product={product}
          />
        ))}
      </div>
      {selectedProduct && (
        <QuickViewModal onClose={closeQuickView} product={selectedProduct} />
      )}
    </>
  );
}

export function ProductGridSkeleton({ count = 8 }: ProductGridSkeletonProps) {
  return (
    <div
      aria-label="Cargando productos"
      aria-live="polite"
      className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-6"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
