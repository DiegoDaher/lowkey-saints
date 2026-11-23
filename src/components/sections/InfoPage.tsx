import type { ReactNode } from "react";

/** Estructura común de las páginas informativas enlazadas desde el footer. */
export default function InfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-10 px-6 py-12 sm:py-16">
      <header className="space-y-4">
        <p className="store-eyebrow">{eyebrow}</p>
        <h1 className="font-display text-4xl font-bold uppercase sm:text-5xl">
          {title}
        </h1>
        <div className="text-muted max-w-2xl leading-7">{intro}</div>
      </header>
      {children}
    </main>
  );
}
