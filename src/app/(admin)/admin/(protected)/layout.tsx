import { requireAdmin } from "@/server/auth/supabase";
import { logout } from "@/server/auth/actions";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl justify-end gap-6 px-6 pt-4">
        <Link href="/140210/perfil" className="underline">
          Mi perfil
        </Link>
        <form action={logout}>
          <button className="underline">Cerrar sesión</button>
        </form>
      </div>
      {children}
    </>
  );
}
