import AdminConsole from "@/components/admin/AdminConsole";
import { requireAdmin } from "@/server/auth/supabase";
export default async function Admin() {
  const profile = await requireAdmin();
  return <AdminConsole initialProfile={profile} />;
}
