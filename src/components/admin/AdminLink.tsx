"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" className="admin-updating">
      <span className="admin-spinner" aria-hidden="true" />
      Abriendo sección…
    </span>
  ) : null;
}
export default function AdminLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props} prefetch={false}>
      {children}
      <Pending />
    </Link>
  );
}
