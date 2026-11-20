import UsersWorkspace from "@/components/admin/UsersWorkspace";
import { requireAdmin } from "@/server/auth/supabase";

export default async function UsersPage() {
  const profile = await requireAdmin("roles");
  return <UsersWorkspace ownId={profile.id} />;
}
