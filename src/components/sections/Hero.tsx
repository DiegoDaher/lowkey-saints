"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export interface HeroMedia {
  type: "video" | "image";
  src: string;
  poster?: string;
  alt: string;
}

interface HeroProps {
  collection: string;
  media: HeroMedia;
  subtitle: string;
  title: ReactNode;
}

export default function Hero({
  collection,
  media,
  subtitle,
  title,
}: HeroProps) {
  const [usePoster, setUsePoster] = useState(media.type === "image");
  const poster = media.poster ?? "/images/hero-editorial.svg";

  useEffect(() => {
    if (media.type !== "video") return;

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;

    function updateMediaPreference() {
      setUsePoster(
        motionPreference.matches ||
          window.matchMedia("(max-width: 767px)").matches ||
          connection?.saveData === true
      );
    }

    updateMediaPreference();
    motionPreference.addEventListener("change", updateMediaPreference);
    window.addEventListener("resize", updateMediaPreference);

    return () => {
      motionPreference.removeEventListener("change", updateMediaPreference);
      window.removeEventListener("resize", updateMediaPreference);
    };
  }, [media.type]);

  return (
    <section
      aria-label={collection}
      className="bg-ink text-paper relative isolate flex min-h-[72svh] items-end overflow-hidden sm:min-h-[78svh] lg:min-h-[90svh]"
    >
      {media.type === "video" && !usePoster ? (
        <video
          aria-hidden="true"
          autoPlay
          className="absolute inset-0 -z-20 size-full object-cover"
          loop
          muted
          playsInline
          poster={poster}
          preload="metadata"
          onError={() => setUsePoster(true)}
        >
          <source src={media.src} />
        </video>
      ) : (
        <Image
          alt={media.alt}
          className="absolute inset-0 -z-20 object-cover"
          fill
          priority
          sizes="100vw"
          src={media.type === "image" ? media.src : poster}
        />
      )}

      <div
        aria-hidden="true"
        className="from-ink/75 via-ink/20 to-ink/10 absolute inset-0 -z-10 bg-gradient-to-t"
      />

      <div className="mx-auto w-full max-w-[1440px] px-6 pt-28 pb-12 sm:px-10 sm:pb-16 lg:px-16 lg:pb-24">
        <p className="text-paper/80 mb-4 text-[0.65rem] font-semibold tracking-[0.2em] uppercase sm:text-xs">
          {collection}
        </p>
        <h1 className="font-display max-w-3xl text-6xl leading-[0.88] font-bold tracking-[0.025em] uppercase sm:text-8xl lg:text-[8.5rem]">
          {title}
        </h1>
        <p className="text-paper/85 mt-6 max-w-md text-sm leading-6 sm:text-base">
          {subtitle}
        </p>
        <Link
          className="bg-paper text-ink hover:bg-gold mt-8 inline-flex min-h-12 w-full items-center justify-center px-7 text-xs font-bold tracking-[0.14em] transition-colors duration-300 sm:w-auto"
          href="#catalogo"
        >
          VER COLECCIÓN
        </Link>
      </div>
    </section>
  );
}
