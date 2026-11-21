import type { Metadata } from "next";
import { Barlow_Condensed, Inter, Kaushan_Script } from "next/font/google";
import "./globals.css";
import "./store-interactions.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const kaushanScript = Kaushan_Script({
  variable: "--font-kaushan-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Lowkey Saints — Streetwear con propósito",
  description:
    "Prendas esenciales y drops independientes. Descubre la colección más reciente de Lowkey Saints.",
  icons: {
    icon: [{ url: "/lowkey%20Saints%20Imagen.png", type: "image/png" }],
    apple: [{ url: "/lowkey%20Saints%20Imagen.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${barlowCondensed.variable} ${kaushanScript.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
