import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import InfoPage from "@/components/sections/InfoPage";
import { PICKUP_POINTS } from "@/lib/store-contact";

export const metadata: Metadata = {
  title: "Envíos y puntos de entrega — Lowkey Saints",
  description:
    "Entregamos tus pedidos en Punto Guadiana, Paseo Durango y Portal Durango.",
};

const steps = [
  "Haz tu pedido desde tu bolsa y te apartamos tus piezas por 24 horas.",
  "Te escribimos por WhatsApp para confirmar el pago.",
  "Elegimos juntos el punto, el día y la hora que te queden mejor.",
  "Llegas, recibes tu prenda y listo. Sin costo extra de envío.",
];

export default function ShippingPage() {
  return (
    <InfoPage
      eyebrow="Ayuda · Envíos"
      title="Puntos de entrega"
      intro={
        <p>
          Por ahora entregamos en persona en Durango. Escoge el punto que te
          quede más cerca y lo coordinamos por WhatsApp cuando hagas tu pedido.
        </p>
      }
    >
      <section aria-labelledby="pickup-points">
        <h2
          id="pickup-points"
          className="font-display mb-5 text-sm font-bold tracking-[0.14em]"
        >
          DÓNDE ENTREGAMOS
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {PICKUP_POINTS.map((point) => (
            <li
              key={point.name}
              className="store-panel flex flex-col gap-3 p-5"
            >
              <MapPin aria-hidden="true" className="text-gold-dark" size={22} />
              <div>
                <h3 className="font-display text-xl font-bold uppercase">
                  {point.name}
                </h3>
                <p className="text-muted text-sm">{point.city}</p>
              </div>
              <a
                className="store-link mt-auto inline-flex min-h-11 items-center gap-1 text-sm font-medium"
                href={point.mapsUrl}
                rel="noreferrer"
                target="_blank"
              >
                Ver en el mapa
                <ArrowUpRight aria-hidden="true" size={15} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-it-works" className="space-y-5">
        <h2
          id="how-it-works"
          className="font-display text-sm font-bold tracking-[0.14em]"
        >
          ASÍ FUNCIONA
        </h2>
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span className="font-display text-gold-dark text-2xl leading-none font-bold">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="leading-7">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="store-panel store-receipt space-y-3 p-5 sm:p-8">
        <h2 className="font-display text-lg font-bold uppercase">
          ¿No estás en Durango?
        </h2>
        <p className="leading-7">
          De momento solo manejamos estos tres puntos. Si te interesa otra
          opción,{" "}
          <Link className="store-link" href="/contacto">
            escríbenos
          </Link>{" "}
          y vemos qué se puede hacer. También puedes revisar las{" "}
          <Link className="store-link" href="/preguntas-frecuentes">
            preguntas frecuentes
          </Link>
          .
        </p>
      </section>
    </InfoPage>
  );
}
