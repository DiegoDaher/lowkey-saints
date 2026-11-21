import AuthForm from "@/components/admin/AuthForm";
import { supabaseServer } from "@/server/auth/supabase";
import Link from "next/link";
export default async function ResetPage() {
  const client = await supabaseServer();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return (
      <main className="space-y-4 p-8">
        <p>El enlace no es válido o expiró.</p>
        <Link href="/140210/recuperar">Solicitar otro enlace</Link>
      </main>
    );
  return <AuthForm mode="reset" />;
}
