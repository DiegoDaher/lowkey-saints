import type { Product } from "@/types/product";

export const mockProducts: Product[] = [
  {
    id: "ls-top-001",
    slug: "sudadera-quiet-season",
    name: "Sudadera Quiet Season",
    category: "Tops",
    price: 1290,
    compareAtPrice: 1590,
    currency: "MXN",
    images: {
      primary: "/images/products/hoodie.svg",
      alternate: "/images/products/tee.svg",
      gallery: ["/images/products/hoodie-detail.svg"],
    },
    colors: [
      { name: "Hueso", hex: "#D8D3C7" },
      { name: "Carbón", hex: "#323230" },
    ],
    sizes: ["CH", "M", "G", "EG"],
    badge: "Nuevo",
    description:
      "Una capa esencial de algodón pesado con silueta relajada y detalle bordado.",
  },
  {
    id: "ls-top-002",
    slug: "playera-saint-mark",
    name: "Playera Saint Mark",
    category: "Tops",
    price: 690,
    currency: "MXN",
    images: {
      primary: "/images/products/tee.svg",
      alternate: "/images/products/tee-detail.svg",
    },
    colors: [
      { name: "Blanco roto", hex: "#E5E0D5" },
      { name: "Negro", hex: "#171716" },
      { name: "Oliva", hex: "#666653" },
    ],
    sizes: ["CH", "M", "G", "EG"],
    description:
      "Playera de algodón suave con gráfico tonal y corte amplio para uso diario.",
  },
  {
    id: "ls-pant-001",
    slug: "pantalon-forma-relajada",
    name: "Pantalón Forma Relajada",
    category: "Pantalones",
    price: 1490,
    currency: "MXN",
    images: {
      primary: "/images/products/pants.svg",
      alternate: "/images/products/pants-detail.svg",
    },
    colors: [
      { name: "Arena", hex: "#C6BDAA" },
      { name: "Negro", hex: "#171716" },
    ],
    sizes: ["CH", "M", "G", "EG"],
    description:
      "Pantalón utilitario de caída recta, cintura cómoda y bolsillos amplios.",
  },
  {
    id: "ls-acc-001",
    slug: "gorra-low-profile",
    name: "Gorra Low Profile",
    category: "Accesorios",
    price: 590,
    currency: "MXN",
    images: {
      primary: "/images/products/cap.svg",
      alternate: "/images/products/cap-detail.svg",
    },
    colors: [
      { name: "Negro", hex: "#171716" },
      { name: "Hueso", hex: "#D8D3C7" },
    ],
    sizes: ["Unitalla"],
    description:
      "Gorra de perfil bajo con ajuste posterior y bordado discreto al frente.",
  },
  {
    id: "ls-drop-001",
    slug: "hoodie-after-hours",
    name: "Hoodie After Hours",
    category: "Drops",
    price: 1590,
    currency: "MXN",
    images: {
      primary: "/images/products/hoodie-detail.svg",
      alternate: "/images/products/hoodie.svg",
    },
    colors: [{ name: "Gris piedra", hex: "#AAA69B" }],
    sizes: ["CH", "M", "G"],
    badge: "Drop",
    description:
      "Edición limitada de gramaje alto, pensada para las noches que se alargan.",
  },
  {
    id: "ls-shoe-001",
    slug: "tenis-everyday",
    name: "Tenis Everyday",
    category: "Calzado",
    price: 1890,
    currency: "MXN",
    images: {
      primary: "/images/products/sneakers.svg",
      alternate: "/images/products/sneakers-detail.svg",
    },
    colors: [
      { name: "Tiza", hex: "#E8E5DC" },
      { name: "Negro", hex: "#171716" },
    ],
    sizes: ["24", "25", "26", "27", "28", "29"],
    description:
      "Tenis de líneas limpias con suela cómoda para acompañar todos los días.",
  },
  {
    id: "ls-top-003",
    slug: "playera-still-here",
    name: "Playera Still Here",
    category: "Tops",
    price: 720,
    currency: "MXN",
    images: {
      primary: "/images/products/tee-detail.svg",
      alternate: "/images/products/tee.svg",
    },
    colors: [{ name: "Grafito", hex: "#555451" }],
    sizes: ["CH", "M", "G", "EG"],
    badge: "Nuevo",
    description:
      "Algodón de tacto seco y un gráfico pequeño que deja hablar al corte.",
  },
  {
    id: "ls-acc-002",
    slug: "bolsa-everywhere",
    name: "Bolsa Everywhere",
    category: "Accesorios",
    price: 490,
    currency: "MXN",
    images: {
      primary: "/images/products/cap-detail.svg",
      alternate: "/images/products/cap.svg",
    },
    colors: [{ name: "Natural", hex: "#D8D3C7" }],
    sizes: ["Unitalla"],
    description:
      "Bolsa ligera de uso diario para llevar lo esencial sin complicaciones.",
  },
  {
    id: "ls-pant-002",
    slug: "pantalon-studio",
    name: "Pantalón Studio",
    category: "Pantalones",
    price: 1390,
    currency: "MXN",
    images: {
      primary: "/images/products/pants-detail.svg",
      alternate: "/images/products/pants.svg",
    },
    colors: [{ name: "Oliva", hex: "#666653" }],
    sizes: ["CH", "M", "G", "EG"],
    badge: "Agotado",
    description:
      "Pantalón de algodón estructurado con bolsillos funcionales y fit relajado.",
  },
  {
    id: "ls-drop-002",
    slug: "sudadera-quiet-season-archive",
    name: "Sudadera Quiet Season Archive",
    category: "Drops",
    price: 1390,
    compareAtPrice: 1690,
    currency: "MXN",
    images: {
      primary: "/images/products/hoodie.svg",
      alternate: "/images/products/hoodie-detail.svg",
    },
    colors: [{ name: "Hueso", hex: "#D8D3C7" }],
    sizes: ["CH", "M", "G"],
    badge: "Drop",
    description:
      "Una pieza de archivo en algodón pesado, disponible por tiempo limitado.",
  },
];
