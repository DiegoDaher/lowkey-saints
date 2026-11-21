import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect, unauthorized, unstable_rethrow } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  hasPermission,
  type AdminPermission,
  type AdminProfile,
} from "../../../supabase/functions/_shared/admin-access";

export async function supabaseServer() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("Acceso administrativo pendiente de configuración");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options)
          );
        } catch {
          /* Server Components cannot set cookies; proxy refreshes them. */
        }
      },
    },
  });
}

export const getAdminProfile = cache(async (): Promise<AdminProfile> => {
  const client = await supabaseServer();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new ApiError(401, "Inicia sesión");
  // getSession supplies the transport token only; getUser and the API validate it.
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) throw new ApiError(401, "Inicia sesión");
  const profile = await api<AdminProfile>(
    "/admin/me",
    {},
    session.access_token
  );
  if (
    profile.id !== user.id ||
    !profile.active ||
    !hasPermission(profile.role, "session")
  )
    throw new ApiError(403, "No tienes acceso administrativo");
  return profile;
});

export async function requireAdmin(permission: AdminPermission = "session") {
  let profile: AdminProfile;
  try {
    profile = await getAdminProfile();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 401) unauthorized();
    if (error instanceof ApiError && error.status === 403)
      redirect("/140210/sin-acceso");
    throw new Error("No se pudo verificar el acceso. Intenta de nuevo.");
  }
  if (!hasPermission(profile.role, permission)) redirect("/140210/sin-acceso");
  return profile;
}
