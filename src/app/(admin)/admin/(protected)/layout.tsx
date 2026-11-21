import { requireAdmin } from "@/server/auth/supabase";
import { logout } from "@/server/auth/actions";
import AdminNavigation from "@/components/admin/AdminNavigation";
import AdminButton from "@/components/admin/AdminButton";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  return (
    <div className="admin-shell">
      <a className="admin-skip" href="#admin-content">
        Saltar al contenido
      </a>
      <AdminNavigation role={profile.role} />
      <div className="admin-content" id="admin-content" tabIndex={-1}>
        <div className="admin-topbar">
          <span>Espacio de trabajo</span>
          <form action={logout}>
            <AdminButton>Cerrar sesión</AdminButton>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
