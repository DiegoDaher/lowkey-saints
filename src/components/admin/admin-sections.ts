import type { AdminRole } from "../../../supabase/functions/_shared/admin-access";
const sections = [
  {
    slug: "",
    label: "Inicio",
    description: "Tu espacio de trabajo",
    operator: true,
  },
  {
    slug: "productos",
    label: "Productos",
    description: "Administra prendas, variantes e imágenes.",
    operator: false,
  },
  {
    slug: "inventario",
    label: "Inventario",
    description: "Consulta y actualiza las existencias por variante.",
    operator: true,
  },
  {
    slug: "ordenes",
    label: "Órdenes",
    description: "Revisa pagos, envíos y el estado de cada pedido.",
    operator: true,
  },
  {
    slug: "restock",
    label: "Reposición",
    description: "Consulta las suscripciones y avisos de disponibilidad.",
    operator: false,
  },
  {
    slug: "finanzas",
    label: "Finanzas",
    description: "Controla precios, costos y márgenes del catálogo.",
    operator: false,
  },
  {
    slug: "usuarios",
    label: "Usuarios",
    description: "Administra el acceso y los permisos del equipo.",
    operator: false,
  },
];
export const adminHref = (slug: string) => "/140210" + (slug ? "/" + slug : "");
export const adminSections = (role: AdminRole) =>
  sections.filter((s) => role === "ADMIN" || s.operator);
