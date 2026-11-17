import Hero from "@/components/sections/Hero";
import Image from "next/image";
import CatalogSection from "@/components/catalog/CatalogSection";

export default function Home() {
  return (
    <main className="store-home">
      <Hero
        collection="Colección 01 / 2026"
        images={[
          {
            src: "/images/editorial/essentials-bone.webp",
            alt: "Hoodie Essentials color hueso, vista trasera",
          },
          {
            src: "/images/editorial/alo-coffee.webp",
            alt: "Hoodie Alo color café, vista frontal",
          },
        ]}
        subtitle="Prendas para moverte a tu manera. Hechas para quedarse."
        title={
          <>
            Viste tu
            <br />
            <span className="font-script text-gold font-normal tracking-normal normal-case">
              esencia
            </span>
          </>
        }
      />
      <CatalogSection />
      <section className="store-editorial" aria-label="El estilo Lowkey Saints">
        <div>
          <p className="store-eyebrow">Menos ruido. Más tú.</p>
          <h2 className="font-display">
            Tu ritmo.
            <br />
            <span>Tu uniforme.</span>
          </h2>
          <p>Piezas que van contigo, todos los días.</p>
        </div>
        <div className="store-editorial-art" aria-hidden="true">
          <Image
            src="/images/editorial/alo-coffee.webp"
            alt=""
            fill
            sizes="(max-width: 767px) 70vw, 30vw"
            className="object-contain"
          />
        </div>
      </section>
    </main>
  );
}
