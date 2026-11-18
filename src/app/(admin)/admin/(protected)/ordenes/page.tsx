import { requireAdmin } from "@/server/auth/supabase";
import OrdersConsole from "@/components/admin/OrdersConsole";

export default async function OrdersPage() {
  await requireAdmin("orders");
  return <OrdersConsole />;
}
