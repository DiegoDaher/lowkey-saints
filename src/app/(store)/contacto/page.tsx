import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import InfoPage from "@/components/sections/InfoPage";
import InstagramIcon from "@/components/icons/InstagramIcon";
import { CONTACT_EMAIL, INSTAGRAM, getWhatsApp } from "@/lib/store-contact";

export const metadata: Metadata = {
  title: "Contacto — Lowkey Saints",
  description: "Escríbenos por WhatsApp, correo o Instagram.",
};

type Channel = {
  label: string;
  value: string;
  href: string;
  note: string;
  icon: ReactNode;
  external?: boolean;
};

export default function ContactPage() {
  const whatsapp = getWhatsApp();
  const channels: Channel[] = [
    ...(whatsapp
      ? [
          {
            label: "WhatsApp",
            value: "WhatsApp",
            href: whatsapp.url,
            note: "La vía más rápida: pedidos, pagos y entregas.",
            icon: <MessageCircle aria-hidden="true" size={22} />,
            external: true,
          },
        ]
      : []),
    {
      label: "Correo",
      value: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}`,
      note: "Dudas generales, colaboraciones o temas de tu pedido.",
      icon: <Mail aria-hidden="true" size={22} />,
    },
    {
      label: "Instagram",
      value: INSTAGRAM.handle,
      href: INSTAGRAM.url,
      note: "Drops, novedades y mensajes directos.",
      icon: <InstagramIcon size={22} />,
      external: true,
    },
  ];

  return (
    <InfoPage
      eyebrow="Ayuda · Contacto"
      title="Hablemos"
      intro={
        <p>
          ¿Dudas con tu talla, tu pedido o una entrega? Escríbenos por donde te
          acomode y te respondemos lo antes posible.
        </p>
      }
    >
      <ul className="grid gap-4">
        {channels.map((channel) => (
          <li key={channel.label}>
            <a
              className="store-panel group flex items-center gap-4 p-5 sm:p-6"
              href={channel.href}
              {...(channel.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              <span className="text-gold-dark shrink-0">{channel.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="store-eyebrow block">{channel.label}</span>
                <span className="font-display block text-xl font-bold break-all sm:text-2xl">
                  {channel.value}
                </span>
                <span className="text-muted block text-sm">{channel.note}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                size={18}
              />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-muted leading-7">
        Antes de escribir, quizá tu respuesta ya esté en{" "}
        <Link className="store-link" href="/preguntas-frecuentes">
          preguntas frecuentes
        </Link>{" "}
        o en{" "}
        <Link className="store-link" href="/envios">
          puntos de entrega
        </Link>
        .
      </p>
    </InfoPage>
  );
}
