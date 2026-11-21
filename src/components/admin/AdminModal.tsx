"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import AdminButton from "./AdminButton";
/** Native dialog supplies focus containment and makes the background inert. */
export default function AdminModal({
  title,
  children,
  footer,
  navigation,
  dirty,
  busy,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  navigation?: ReactNode;
  dirty: boolean;
  busy: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    heading.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (confirm) cancel.current?.focus();
    else heading.current?.focus();
  }, [confirm]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty, busy]);
  function requestClose() {
    if (busy) return;
    if (dirty) setConfirm(true);
    else onClose();
  }
  return (
    <dialog
      ref={ref}
      className="admin-modal admin-form"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (confirm) setConfirm(false);
        else requestClose();
      }}
    >
      <div className="admin-modal-header">
        <div>
          <p className="admin-eyebrow">LOWKEY SAINTS / CATÁLOGO</p>
          <h2 id={id} ref={heading} tabIndex={-1}>
            {confirm ? "Hay cambios sin guardar" : title}
          </h2>
        </div>
        <AdminButton
          type="button"
          disabled={busy}
          onClick={requestClose}
          aria-label="Cerrar editor"
        >
          Cerrar
        </AdminButton>
      </div>
      <div hidden={confirm} className="admin-modal-editor">
        {navigation}
        <div className="admin-modal-body">{children}</div>
        {footer && <footer className="admin-modal-footer">{footer}</footer>}
      </div>
      {confirm && (
        <div className="admin-modal-confirm">
          <p>
            Los cambios que no has guardado se perderán. Los cambios ya
            guardados se conservarán.
          </p>
          <div className="flex flex-wrap gap-3">
            <AdminButton
              ref={cancel}
              type="button"
              onClick={() => setConfirm(false)}
            >
              Seguir editando
            </AdminButton>
            <AdminButton type="button" variant="danger" onClick={onClose}>
              Descartar cambios y cerrar
            </AdminButton>
          </div>
        </div>
      )}
    </dialog>
  );
}
