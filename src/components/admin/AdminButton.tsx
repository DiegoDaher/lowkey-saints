"use client";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
export default function AdminButton({
  children,
  className = "",
  pending = false,
  variant,
  disabled,
  ...props
}: ComponentProps<"button"> & {
  pending?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const form = useFormStatus();
  const busy = pending || (props.type !== "button" && form.pending);
  const style =
    variant ?? (className.includes("shop-button") ? "primary" : "secondary");
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || props["aria-busy"]}
      className={`admin-button admin-button--${style} ${className}`}
    >
      {busy && <span className="admin-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
