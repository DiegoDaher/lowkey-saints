import Link from "next/link";
import { requireAdmin, supabaseServer } from "@/server/auth/supabase";
import ProfilePasswordForm from "@/components/admin/ProfilePasswordForm";

export default async function ProfilePage() {
  const profile = await requireAdmin();
  const client = await supabaseServer();
  const {
    data: { user },
  } = await client.auth.getUser();
  return (
    <main className="admin-form mx-auto max-w-xl space-y-6 p-6 md:p-10">
      <Link className="underline" href="/140210">
        Volver a administración
      </Link>
      <h1 className="font-display text-4xl">Mi perfil</h1>
      <dl>
        <dt>Correo</dt>
        <dd>{user?.email}</dd>
        <dt>Rol</dt>
        <dd>{profile.role}</dd>
      </dl>
      <ProfilePasswordForm />
    </main>
  );
}
