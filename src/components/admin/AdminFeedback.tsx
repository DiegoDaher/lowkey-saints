import Loader from "@/components/ui/Loader";
import Spinner from "@/components/ui/Spinner";
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
  if (initial) return <Loader variant="section" label={label} />;
  return (
    <div className="admin-updating">
      <Spinner label={label} />
    </div>
  );
}
