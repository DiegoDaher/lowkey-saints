"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import StoreAction from "@/components/ui/StoreAction";
import { useCatalogFilters } from "@/components/catalog/CatalogFilterProvider";

export interface HeroImage {
  src: string;
  alt: string;
}

interface HeroProps {
  collection: string;
  images: readonly [HeroImage, HeroImage];
  subtitle: string;
  title: ReactNode;
}

export default function Hero({
  collection,
  images,
  subtitle,
  title,
}: HeroProps) {
  const { resetFilters } = useCatalogFilters();
  return (
    <section id="inicio" aria-label={collection} className="store-hero">
      <div className="store-hero-inner">
        <div className="store-hero-copy">
          <p className="store-eyebrow">{collection}</p>
          <h1 className="store-hero-title font-display">{title}</h1>
          <p className="store-hero-lead">{subtitle}</p>
          <div className="store-hero-action">
            <StoreAction href="/#catalogo" onNavigate={resetFilters}>
              VER COLECCIÓN
            </StoreAction>
          </div>
          <p className="store-hero-note">
            Alo / Essentials / Tu propia frecuencia
          </p>
        </div>
        <div className="store-hero-collage">
          <div className="store-hero-orbit" aria-hidden="true" />
          {images.map((image, index) => (
            <div
              className={`store-hero-piece store-hero-piece--${index + 1}`}
              key={image.src}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                preload={index === 0}
                loading={index === 1 ? "eager" : undefined}
                sizes="(max-width: 767px) 65vw, 40vw"
                className="object-contain"
              />
            </div>
          ))}
          <span className="store-hero-stamp" aria-hidden="true">
            LOWKEY
            <br />
            EVERY DAY.
          </span>
          <span className="store-hero-caption"></span>
        </div>
      </div>
    </section>
  );
}
