import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import InfoPage from "@/components/sections/InfoPage";

export const metadata: Metadata = {
  title: "Preguntas frecuentes — Lowkey Saints",
  description:
    "Cómo comprar en Lowkey Saints: catálogo, bolsa, pedido por WhatsApp, pago, entregas y avisos de reposición.",
};

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link className="store-link font-medium" href={href}>
    {children}
  </Link>
);

const faqs: { group: string; items: { q: string; a: ReactNode }[] }[] = [
  {
    group: "Comprar",
    items: [
      {
        q: "¿Cómo hago un pedido?",
        a: (
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Date una vuelta por el <A href="/#catalogo">catálogo</A> y filtra
              por categoría, talla, color o precio.
            </li>
            <li>Entra a la prenda que te guste y elige tu talla y color.</li>
            <li>
              Dale a <strong>Agregar a la bolsa</strong>.
            </li>
            <li>
              Abre tu <A href="/bolsa">bolsa</A>, revisa cantidades y deja tu
              nombre y teléfono.
            </li>
            <li>
              Toca <strong>Crear pedido</strong> y luego{" "}
              <strong>Continuar en WhatsApp</strong>. Ahí terminamos todo
              contigo.
            </li>
          </ol>
        ),
      },
      {
        q: "¿Necesito crear una cuenta?",
        a: "Nop. Solo te pedimos nombre y teléfono para apartar tu pedido y poder contactarte.",
      },
      {
        q: "¿Me apartan las piezas?",
        a: "Sí. En cuanto creas tu pedido te guardamos las prendas por 24 horas. Si no lo confirmamos en ese tiempo, se liberan para alguien más.",
      },
      {
        q: "El precio de mi bolsa cambió al crear el pedido, ¿por qué?",
        a: "El subtotal de la bolsa es estimado. El precio y la disponibilidad se confirman justo al crear tu pedido, así que lo que ves en el resumen es lo que vale.",
      },
    ],
  },
  {
    group: "Pago y entrega",
    items: [
      {
        q: "¿Cómo pago?",
        a: "El pago lo coordinamos contigo por WhatsApp después de crear tu pedido. Te mandamos los detalles por ahí.",
      },
      {
        q: "¿Dónde me entregan?",
        a: (
          <>
            Por ahora entregamos en Punto Guadiana, Paseo Durango y Portal
            Durango. Checa los detalles en{" "}
            <A href="/envios">Envíos y puntos de entrega</A>.
          </>
        ),
      },
      {
        q: "¿Puedo cambiar el punto o la hora?",
        a: "Claro, solo avísanos por WhatsApp antes de la entrega y lo reacomodamos.",
      },
    ],
  },
  {
    group: "Agotados y avisos",
    items: [
      {
        q: "Lo que quiero está agotado, ¿y ahora?",
        a: "En la página del producto elige tu talla y color, deja tu correo en «Avísame cuando vuelva» y te escribimos cuando haya otra vez.",
      },
      {
        q: "Ya no quiero recibir avisos",
        a: (
          <>
            Cada correo de aviso trae un enlace para darte de baja. Si después
            cambias de opinión, vuelve a registrarte en el producto y marca{" "}
            <strong>Reactivar mis avisos</strong>.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <InfoPage
      eyebrow="Ayuda · FAQ"
      title="Preguntas frecuentes"
      intro={
        <p>
          Todo lo que necesitas saber para armar tu fit sin broncas. ¿No
          encuentras lo que buscas? <A href="/contacto">Escríbenos</A>.
        </p>
      }
    >
      {faqs.map((section) => (
        <section key={section.group} className="space-y-3">
          <h2 className="font-display text-sm font-bold tracking-[0.14em] uppercase">
            {section.group}
          </h2>
          <div className="border-line border-t">
            {section.items.map((item) => (
              <details key={item.q} className="group border-line border-b">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    aria-hidden="true"
                    className="shrink-0 transition-transform group-open:rotate-180"
                    size={18}
                  />
                </summary>
                <div className="text-muted pb-5 leading-7">{item.a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </InfoPage>
  );
}
