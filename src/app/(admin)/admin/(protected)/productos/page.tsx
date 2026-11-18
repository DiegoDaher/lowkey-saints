import { requireAdmin } from "@/server/auth/supabase";
import CatalogWorkspace from "@/components/admin/CatalogWorkspace";

export default async function ProductsPage() {
  await requireAdmin("catalog:write");
  return <CatalogWorkspace mode="productos" isAdmin />;
}
