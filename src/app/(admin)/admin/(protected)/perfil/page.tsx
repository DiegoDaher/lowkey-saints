import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  UserRound,
  LockKeyhole,
} from "lucide-react";
import { requireAdmin, supabaseServer } from "@/server/auth/supabase";
import ProfilePasswordForm from "@/components/admin/ProfilePasswordForm";

export default async function ProfilePage() {
  const profile = await requireAdmin();
  const client = await supabaseServer();
  const {
    data: { user },
  } = await client.auth.getUser();
  const email = user?.email || "Correo no disponible";
  const roleLabel = profile.role === "ADMIN" ? "Administrador" : "Operador";
  return (
    <main className="admin-form mx-auto space-y-8 p-6 md:p-10">
      <Link className="inline-flex items-center gap-2 text-sm" href="/140210">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a administración
      </Link>
      <header className="admin-heading">
        <p className="admin-eyebrow">TU CUENTA</p>
        <h1>Mi perfil</h1>
        <p>Consulta los datos de tu cuenta y administra tu contraseña.</p>
      </header>
      <div className="grid max-w-5xl items-start gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section
          aria-labelledby="profile-account-title"
          className="overflow-hidden rounded-xl border border-[#deded8] bg-white"
        >
          <div className="border-b border-[#e2dbce] bg-[#f0ece3] p-6 sm:p-8">
            <div
              aria-hidden="true"
              className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-[#d7c39f] bg-white/70 text-2xl font-semibold text-[#694b20]"
            >
              {user?.email?.charAt(0).toUpperCase() || <UserRound size={28} />}
            </div>
            <h2 id="profile-account-title" className="text-xl">
              Información de la cuenta
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#62645f]">
              Tu identidad dentro de Lowkey Saints.
            </p>
          </div>
          <dl className="divide-y divide-[#deded8] px-6 sm:px-8">
            <div className="py-6">
              <dt className="mb-2 flex items-center gap-2 text-xs font-medium text-[#62645f]">
                <Mail size={16} aria-hidden="true" /> Correo electrónico
              </dt>
              <dd className="text-base font-medium [overflow-wrap:anywhere]">
                {email}
              </dd>
            </div>
            <div className="py-6">
              <dt className="mb-3 flex items-center gap-2 text-xs font-medium text-[#62645f]">
                <ShieldCheck size={16} aria-hidden="true" /> Rol de acceso
              </dt>
              <dd>
                <span className="inline-flex rounded-full border border-[#d7c39f] bg-[#f4eee3] px-3 py-1 text-xs font-semibold text-[#694b20]">
                  {roleLabel}
                </span>
                <p className="mt-3 text-sm leading-relaxed text-[#62645f]">
                  {profile.role === "ADMIN"
                    ? "Acceso a la administración, finanzas y gestión de usuarios."
                    : "Acceso a las herramientas de operación de la tienda."}
                </p>
              </dd>
            </div>
          </dl>
        </section>
        <div className="rounded-xl border border-[#deded8] bg-white p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-2 text-xs font-semibold tracking-wider text-[#7a694f]">
            <LockKeyhole size={16} aria-hidden="true" /> SEGURIDAD
          </div>
          <ProfilePasswordForm />
        </div>
      </div>
    </main>
  );
}
