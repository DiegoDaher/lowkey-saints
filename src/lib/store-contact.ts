/**
 * Datos públicos de contacto y entrega de la tienda.
 * Fuente única para el footer y las páginas de Envíos, Preguntas frecuentes y Contacto.
 */

export const INSTAGRAM = {
  handle: "@lowkey_saints",
  url: "https://www.instagram.com/lowkey_saints/",
} as const;

/** Correo simulado hasta contar con el dominio definitivo. */
export const CONTACT_EMAIL = "hola@lowkey-saints.com";

export type PickupPoint = {
  name: string;
  city: string;
  mapsUrl: string;
};

const mapsSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const PICKUP_POINTS: PickupPoint[] = [
  {
    name: "Punto Guadiana",
    city: "Durango, Dgo.",
    mapsUrl: mapsSearch("Punto Guadiana Durango"),
  },
  {
    name: "Paseo Durango",
    city: "Durango, Dgo.",
    mapsUrl: mapsSearch("Paseo Durango"),
  },
  {
    name: "Portal Durango",
    city: "Durango, Dgo.",
    mapsUrl: mapsSearch("Portal Durango"),
  },
];

/**
 * Número comercial de WhatsApp. Reutiliza `WHATSAPP_PHONE`, la misma variable
 * que usa la API para generar el enlace del pedido. Solo debe llamarse desde
 * Server Components.
 */
export function getWhatsApp() {
  const digits = process.env.WHATSAPP_PHONE?.replace(/\D/g, "") ?? "";
  if (!/^\d{8,15}$/.test(digits)) return null;
  const local = digits.slice(-10);
  const country = digits.slice(0, -10);
  const display = `${country ? `+${country} ` : ""}${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return { url: `https://wa.me/${digits}`, display };
}
