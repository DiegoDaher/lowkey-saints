"use server";
import {
  financialPricesInput,
  financialSettingsInput,
} from "../../../../supabase/functions/_shared/financial-contracts";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { getAdminProfile, supabaseServer } from "@/server/auth/supabase";
import {
  hasPermission,
  type AdminPermission,
} from "../../../../supabase/functions/_shared/admin-access";
import {
  type CatalogProduct,
  archiveInput,
  id,
  productInput,
  stockInput,
  variantInput,
  variantUpdateInput,
} from "../../../../supabase/functions/_shared/contracts";

async function mutate<T = never>(
  permission: AdminPermission,
  path: string,
  method: string,
  schema: z.ZodType,
  input: unknown,
  includeData = false
) {
  try {
    const profile = await getAdminProfile();
    if (!hasPermission(profile.role, permission))
      throw new ApiError(403, "No tienes permiso");
    const value = schema.parse(input);
    const client = await supabaseServer();
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) throw new ApiError(401, "Inicia sesión de nuevo");
    const data = await api<T>(
      path,
      { method, body: JSON.stringify(value) },
      session.access_token
    );
    revalidatePath("/140210/finanzas");
    revalidatePath("/admin/finanzas");
    revalidatePath("/140210/productos");
    revalidatePath("/admin/productos");
    revalidatePath("/admin/inventario");
    return { ok: true as const, ...(includeData ? { data } : {}) };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof z.ZodError)
      return {
        ok: false as const,
        status: 400,
        message: "Revisa los campos del formulario",
        fields: z.flattenError(error).fieldErrors,
      };
    return {
      ok: false as const,
      status: error instanceof ApiError ? error.status : 500,
      message:
        error instanceof ApiError
          ? error.message
          : "No se pudo guardar. Intenta de nuevo.",
    };
  }
}

export async function saveProduct(productId: string | null, input: unknown) {
  if (productId !== null && !id.safeParse(productId).success)
    return { ok: false as const, status: 400, message: "Producto inválido" };
  return mutate<CatalogProduct>(
    "catalog:write",
    "/admin/products" + (productId ? "/" + productId : ""),
    productId ? "PUT" : "POST",
    productInput,
    input,
    true
  );
}
export async function setProductArchived(productId: string, input: unknown) {
  if (!id.safeParse(productId).success)
    return { ok: false as const, status: 400, message: "Producto inválido" };
  return mutate(
    "catalog:write",
    "/admin/products/" + productId,
    "PATCH",
    archiveInput,
    input
  );
}
export async function saveVariant(variantId: string | null, input: unknown) {
  if (variantId !== null && !id.safeParse(variantId).success)
    return { ok: false as const, status: 400, message: "Variante inválida" };
  return mutate(
    "catalog:write",
    "/admin/variants" + (variantId ? "/" + variantId : ""),
    variantId ? "PATCH" : "POST",
    variantId ? variantUpdateInput : variantInput,
    input
  );
}
export async function updateStock(input: unknown) {
  return mutate("stock:write", "/admin/stock", "PATCH", stockInput, input);
}

export async function saveFinancialPrices(productId: string, input: unknown) {
  if (!id.safeParse(productId).success)
    return { ok: false as const, status: 400, message: "Producto inválido" };
  return mutate(
    "finances",
    "/admin/finances/products/" + productId,
    "PATCH",
    financialPricesInput,
    input
  );
}
export async function saveFinancialSettings(input: unknown) {
  return mutate(
    "finances",
    "/admin/finances/settings",
    "PUT",
    financialSettingsInput,
    input
  );
}
