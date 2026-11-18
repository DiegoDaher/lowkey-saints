"use server";

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
  archiveInput,
  id,
  productInput,
  stockInput,
  variantInput,
  variantUpdateInput,
} from "../../../../supabase/functions/_shared/contracts";

async function mutate(
  permission: AdminPermission,
  path: string,
  method: string,
  schema: z.ZodType,
  input: unknown
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
    await api(
      path,
      { method, body: JSON.stringify(value) },
      session.access_token
    );
    revalidatePath("/admin/productos");
    revalidatePath("/admin/inventario");
    return { ok: true as const };
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
  return mutate(
    "catalog:write",
    "/admin/products" + (productId ? "/" + productId : ""),
    productId ? "PUT" : "POST",
    productInput,
    input
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
