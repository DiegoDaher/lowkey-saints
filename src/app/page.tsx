import Hero from "@/components/sections/Hero";
import CatalogSection from "@/components/catalog/CatalogSection";
import { mockProducts } from "@/data/mock-products";

export default function Home() {
  return (
    <main>
      <Hero
        collection="Colección 01 / 2026"
        media={{
          type: "image",
          src: "/images/hero-editorial.svg",
          alt: "Composición editorial de la colección Lowkey Saints",
        }}
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
      <CatalogSection products={mockProducts} />
    </main>
  );
}
