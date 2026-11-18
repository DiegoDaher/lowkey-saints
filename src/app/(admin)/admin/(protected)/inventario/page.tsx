import { requireAdmin } from "@/server/auth/supabase";
import CatalogWorkspace from "@/components/admin/CatalogWorkspace";

export default async function InventoryPage() {
  const profile = await requireAdmin("stock:write");
  return (
    <CatalogWorkspace mode="inventario" isAdmin={profile.role === "ADMIN"} />
  );
}
