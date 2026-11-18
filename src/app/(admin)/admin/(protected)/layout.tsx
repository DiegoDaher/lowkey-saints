import { requireAdmin } from "@/server/auth/supabase";
import { logout } from "@/server/auth/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl justify-end px-6 pt-4">
        <form action={logout}>
          <button className="underline">Cerrar sesión</button>
        </form>
      </div>
      {children}
    </>
  );
}
