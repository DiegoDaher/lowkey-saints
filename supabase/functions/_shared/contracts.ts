import { z } from "zod";
export const id = z.string().uuid();
export const money = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Importe inválido");
const text = z.string().trim().min(1).max(200);
export const orderInput = z
  .object({
    idempotencyKey: id,
    clientName: text.max(100),
    clientPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{8,25}$/)
      .transform((value) => value.replace(/[+ ()-]/g, ""))
      .refine((value) => /^\d{8,15}$/.test(value), "Teléfono inválido"),
    items: z
      .array(
        z.object({ variantId: id, quantity: z.number().int().min(1).max(20) })
      )
      .min(1)
      .max(50),
  })
  .strict();
export const subscriptionInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    variantId: id,
    reactivate: z.boolean().default(false),
  })
  .strict();
export const stockInput = z
  .object({
    changes: z
      .array(
        z.object({
          id,
          version: z.number().int().nonnegative(),
          stock: z.number().int().min(0).max(100000),
        })
      )
      .min(1)
      .max(100),
  })
  .strict();
const measurement = z.object({
  size: text.max(30),
  chestCm: money.nullable(),
  waistCm: money.nullable(),
  hipCm: money.nullable(),
});
export const productInput = z
  .object({
    name: text,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(150),
    description: z.string().max(10000),
    materials: z.string().max(2000),
    specifications: z.string().max(5000),
    salePrice: money,
    isArchived: z.boolean().default(false),
    version: z.number().int().nonnegative().optional(),
    modelHeightCm: money.nullable(),
    modelSize: z.string().max(30).nullable(),
    categoryIds: z.array(id).min(1).max(20),
    images: z
      .array(
        z.object({
          path: z.string().regex(/^[a-f0-9-]+\.(jpg|png|webp)$/),
          alt: z.string().max(200),
        })
      )
      .max(12),
    measurements: z.array(measurement).max(30),
    complementaryIds: z.array(id).max(3),
  })
  .strict();
export const variantInput = z
  .object({
    productId: id,
    size: text.max(30),
    color: text.max(60),
    colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sku: text.max(80),
  })
  .strict();
export const statusInput = z
  .object({ status: z.enum(["CONFIRMED", "SHIPPED", "CANCELLED"]) })
  .strict();
export type CreateOrderInput = z.infer<typeof orderInput>;
export type ProductInput = z.infer<typeof productInput>;
export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  materials: string;
  specifications: string;
  salePrice: string;
  isArchived: boolean;
  version: number;
  modelHeightCm: string | null;
  modelSize: string | null;
  images: {
    id: string;
    path: string;
    alt: string;
    position: number;
    url: string;
  }[];
  categories: { category: { id: string; name: string; slug: string } }[];
  measurements: {
    size: string;
    chestCm: string | null;
    waistCm: string | null;
    hipCm: string | null;
  }[];
  variants: {
    id: string;
    size: string;
    color: string;
    colorHex: string;
    sku: string;
    stock: number;
    version: number;
    isArchived: boolean;
  }[];
  complements?: { complementary: CatalogProduct }[];
}
export interface OrderReceipt {
  id: string;
  orderNumber: number;
  status: string;
  totalAmount: string;
  expiresAt: string;
  whatsappUrl: string;
}
export interface AdminOrder {
  id: string;
  orderNumber: number;
  status: string;
  clientName: string;
  clientPhone: string;
  totalAmount: string;
  expiresAt: string;
  items: {
    productName: string;
    size: string;
    color: string;
    quantity: number;
    price: string;
  }[];
}
