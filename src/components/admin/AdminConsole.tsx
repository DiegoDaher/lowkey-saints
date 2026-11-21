import Link from "./AdminLink";
import { ArrowUpRight } from "lucide-react";
import type { AdminProfile } from "../../../supabase/functions/_shared/admin-access";
import { adminSections, adminHref } from "./admin-sections";
import { AdminHeading } from "./AdminFeedback";
export default function AdminConsole({
  initialProfile,
}: {
  initialProfile: AdminProfile;
}) {
  return (
    <main className="admin-form admin-home">
      <AdminHeading title="Administración">
        Todo lo que necesitas para operar la tienda, en un solo lugar.
      </AdminHeading>
      <section className="admin-welcome">
        <span className="admin-eyebrow">TU ESPACIO DE TRABAJO</span>
        <h2>¿Por dónde empezamos?</h2>
        <p>Selecciona una sección para administrar la tienda.</p>
      </section>
      <div className="admin-access-grid">
        {adminSections(initialProfile.role)
          .filter((s) => s.slug)
          .map((section) => (
            <Link
              className="admin-access-card"
              prefetch={false}
              href={adminHref(section.slug)}
              key={section.slug}
            >
              <span className="admin-card-title">
                {section.label}
                <ArrowUpRight aria-hidden="true" size={20} />
              </span>
              <span>{section.description}</span>
              <span className="admin-card-cta">Abrir sección</span>
            </Link>
          ))}
      </div>
    </main>
  );
}
