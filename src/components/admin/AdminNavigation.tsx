"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Bell,
  ChartNoAxesCombined,
  Users,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import type { AdminRole } from "../../../supabase/functions/_shared/admin-access";
import { adminSections, adminHref } from "./admin-sections";
import AdminButton from "./AdminButton";
const icons = [
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Bell,
  ChartNoAxesCombined,
  Users,
];
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" className="admin-nav-pending">
      <span className="admin-spinner" aria-hidden="true" />
      <span className="sr-only">Abriendo sección…</span>
    </span>
  ) : null;
}
export default function AdminNavigation({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  const links = (
    <nav aria-label="Administración" className="admin-nav">
      {adminSections(role).map((section) => {
        const Icon =
          icons[
            [
              "",
              "productos",
              "inventario",
              "ordenes",
              "restock",
              "finanzas",
              "usuarios",
            ].indexOf(section.slug)
          ];
        const href = adminHref(section.slug);
        const active = pathname.replace(/^\/admin(?=\/|$)/, "/140210") === href;
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            onNavigate={close}
          >
            <Icon size={19} aria-hidden="true" />
            {section.label}
            <Pending />
          </Link>
        );
      })}
      <Link
        href="/140210/perfil"
        prefetch={false}
        onNavigate={close}
        aria-current={pathname.endsWith("/perfil") ? "page" : undefined}
      >
        Mi perfil
        <Pending />
      </Link>
      <Link href="/" prefetch={false} onNavigate={close}>
        Volver a la tienda
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </nav>
  );
  return (
    <>
      <div className="admin-desktop-nav">
        <Link className="admin-brand" href="/140210" prefetch={false}>
          LOWKEY SAINTS<span>Administración</span>
        </Link>
        {links}
        <p className="admin-role">
          {role === "ADMIN" ? "Administrador" : "Operador"}
        </p>
      </div>
      <div className="admin-mobile-bar">
        <span className="admin-brand">LOWKEY SAINTS</span>
        <AdminButton
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          <Menu size={18} />
          Menú
        </AdminButton>
      </div>
      <dialog
        id="admin-mobile-menu"
        ref={dialog}
        className="admin-mobile-dialog"
        onCancel={close}
        onClose={() => setOpen(false)}
      >
        <div className="flex items-center justify-between gap-4">
          <strong>Administración</strong>
          <AdminButton type="button" onClick={close} aria-label="Cerrar menú">
            <X size={18} />
          </AdminButton>
        </div>
        {links}
      </dialog>
    </>
  );
}
