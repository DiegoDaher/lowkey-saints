export interface Product {
  id: string;
  slug: string;
  name: string;
  category: "Tops" | "Pantalones" | "Accesorios" | "Drops" | "Calzado";
  price: number;
  compareAtPrice?: number;
  currency: "MXN";
  images: {
    primary: string;
    alternate?: string;
    gallery?: string[];
  };
  colors?: { name: string; hex: string }[];
  sizes?: string[];
  badge?: "Nuevo" | "Drop" | "Agotado" | string;
  description?: string;
}
