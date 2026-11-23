"use client";

import Image from "next/image";
import Link from "next/link";
import { useCatalogFilters } from "@/components/catalog/CatalogFilterProvider";

export default function Logo({ onNavigate }: { onNavigate?: () => void }) {
  const { resetFilters } = useCatalogFilters();
  return (
    <Link
      aria-label="Lowkey Saints, inicio"
      className="group inline-flex h-24 w-48 items-center justify-center overflow-hidden"
      href="/#inicio"
      onNavigate={() => {
        resetFilters();
        onNavigate?.();
      }}
    >
      <Image
        alt="Lowkey Saints"
        className="h-full w-full object-contain"
        height={1280}
        priority
        src="/lowkey%20Saints%20sin%20fondo.png"
        width={1280}
      />
    </Link>
  );
}
