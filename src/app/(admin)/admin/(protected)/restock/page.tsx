import { requireAdmin } from "@/server/auth/supabase";
import RestockWorkspace from "@/components/admin/RestockWorkspace";
export default async function RestockPage() {
  await requireAdmin("restock");
  return <RestockWorkspace />;
}
