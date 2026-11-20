export type AdminRole = "ADMIN" | "OPERATOR";
export type AdminProfile = { id: string; role: AdminRole; active: boolean };
export type AdminPermission =
  | "session"
  | "catalog:read"
  | "catalog:write"
  | "stock:write"
  | "orders"
  | "restock"
  | "finances"
  | "roles"
  | "images"
  | "health";

const operatorPermissions: readonly AdminPermission[] = [
  "session",
  "catalog:read",
  "stock:write",
  "orders",
];
export function hasPermission(
  role: string,
  permission: AdminPermission
): boolean {
  return (
    role === "ADMIN" ||
    (role === "OPERATOR" && operatorPermissions.includes(permission))
  );
}

/** An unregistered route/method never inherits administrative privileges. */
export function adminPermission(
  route: string,
  method: string
): AdminPermission | null {
  if (route === "/v1/admin/me" && method === "GET") return "session";
  if (route === "/v1/admin/users" && ["GET", "POST"].includes(method))
    return "roles";
  if (
    /^\/v1\/admin\/users\/[^/]+\/password-link$/.test(route) &&
    method === "POST"
  )
    return "roles";
  if (route === "/v1/admin/health" && method === "GET") return "health";
  if (/^\/v1\/admin\/products(?:\/[^/]+)?$/.test(route)) {
    if (method === "GET") return "catalog:read";
    if (
      (route === "/v1/admin/products" && method === "POST") ||
      (route !== "/v1/admin/products" && ["PUT", "PATCH"].includes(method))
    )
      return "catalog:write";
  }
  if (
    (route === "/v1/admin/variants" && method === "POST") ||
    (/^\/v1\/admin\/variants\/[^/]+$/.test(route) && method === "PATCH")
  )
    return "catalog:write";
  if (route === "/v1/admin/stock" && method === "PATCH") return "stock:write";
  if (
    (route === "/v1/admin/orders" && method === "GET") ||
    (/^\/v1\/admin\/orders\/[^/]+\/history$/.test(route) && method === "GET") ||
    (/^\/v1\/admin\/orders\/[^/]+$/.test(route) && method === "PATCH")
  )
    return "orders";
  if (
    (route === "/v1/admin/restock" && method === "GET") ||
    (route === "/v1/admin/restock/retry" && method === "POST")
  )
    return "restock";
  if (
    (route === "/v1/admin/finances/dashboard" && method === "GET") ||
    (route === "/v1/admin/finances/settings" &&
      ["GET", "PUT"].includes(method)) ||
    (/^\/v1\/admin\/finances\/products\/[^/]+$/.test(route) &&
      method === "PATCH")
  )
    return "finances";
  if (route === "/v1/admin/finances" && ["GET", "PUT"].includes(method))
    return "finances";
  if (route === "/v1/admin/roles" && ["GET", "PUT"].includes(method))
    return "roles";
  if (route === "/v1/admin/images" && method === "POST") return "images";
  if (/^\/v1\/admin\/images\/[^/]+$/.test(route) && method === "DELETE")
    return "images";
  return null;
}
