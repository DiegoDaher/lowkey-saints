import type { ReactNode } from "react";
export function AdminHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="admin-heading">
      <p className="admin-eyebrow">LOWKEY SAINTS / EQUIPO</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
export function AdminLoading({
  label = "Cargando…",
  initial = false,
}: {
  label?: string;
  initial?: boolean;
}) {
  return (
    <div role="status" className={initial ? "admin-loading" : "admin-updating"}>
      <span className="admin-spinner" aria-hidden="true" />
      <span>{label}</span>
      {initial && (
        <div className="admin-skeleton" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} />
          ))}
        </div>
      )}
    </div>
  );
}
