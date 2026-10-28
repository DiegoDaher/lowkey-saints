export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base)
    throw new Error("La tienda aún no está conectada. Intenta más tarde.");
  const headers = new Headers(options.headers);
  if (!(options.body instanceof Blob))
    headers.set("Content-Type", "application/json");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key) headers.set("apikey", key);
  if (token) headers.set("Authorization", "Bearer " + token);
  const response = await fetch(base + "/functions/v1/api/v1" + path, {
    ...options,
    headers,
    cache: "no-store",
  });
  const value = await response
    .json()
    .catch(() => ({ error: "No se pudo conectar con la tienda" }));
  if (!response.ok)
    throw new Error(value.error || "No se pudo completar la operación");
  return value;
}
