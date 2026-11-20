import { requireAdmin } from "@/server/auth/supabase";
import FinanceWorkspace from "@/components/admin/FinanceWorkspace";
export default async function FinancePage() {
  await requireAdmin("finances");
  return <FinanceWorkspace />;
}
