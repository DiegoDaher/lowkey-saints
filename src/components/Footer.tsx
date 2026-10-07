import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";

const helpLinks = [
  { label: "Envíos y devoluciones", href: "#" },
  { label: "Preguntas frecuentes", href: "#" },
  { label: "Contacto", href: "#" },
];

export default function Footer() {
  return (
    <footer className="border-line bg-paper border-t">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-12 sm:grid-cols-2 sm:px-8 sm:py-16 lg:grid-cols-3 lg:px-12">
        <div className="flex flex-col items-start gap-5">
          <Logo />
          <p className="text-muted max-w-xs text-sm leading-6">
            Streetwear independiente para quienes eligen su propio camino.
          </p>
        </div>

        <div>
          <h2 className="font-display mb-4 text-sm font-bold tracking-[0.14em]">
            AYUDA
          </h2>
          <ul className="space-y-3">
            {helpLinks.map((link) => (
              <li key={link.label}>
                <Link
                  className="text-muted hover:text-ink text-sm transition-colors"
                  href={link.href}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-start gap-4 sm:col-span-2 lg:col-span-1">
          <h2 className="font-display text-sm font-bold tracking-[0.14em]">
            SÍGUENOS
          </h2>
          <a
            aria-label="Lowkey Saints en Instagram"
            className="hover:text-muted inline-flex items-center gap-2 text-sm font-medium transition-colors"
            href="https://www.instagram.com/"
            rel="noreferrer"
            target="_blank"
          >
            <span aria-hidden="true" className="font-display text-sm font-bold">
              IG
            </span>
            <ArrowUpRight aria-hidden="true" size={15} />
            Instagram
          </a>
        </div>
      </div>

      <div className="border-line text-muted border-t px-6 py-5 text-center text-xs">
        © {new Date().getFullYear()} Lowkey Saints. Todos los derechos
        reservados.
      </div>
    </footer>
  );
}
