"use client";
import { useEffect, useId, useRef, useState } from "react";
import Spinner from "@/components/ui/Spinner";
import StoreAction from "@/components/ui/StoreAction";
import { api } from "@/lib/api";
import {
  loadRememberedEmail,
  rememberEmail,
  restockErrorMessage,
  validateRestockEmail,
} from "../domain/restock-form";

type Status = "idle" | "submitting" | "success";

/**
 * Back-in-stock request for a sold-out variant (LOG-04).
 * Mount with `key={variantId}` so each variant starts from a clean state.
 */
export default function RestockForm({
  variantId,
  variantLabel,
}: {
  variantId: string;
  variantLabel?: string;
}) {
  const ids = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");
  const [savedEmail, setSavedEmail] = useState("");

  // Prefill after mount so server and client render the same markup.
  useEffect(() => {
    const input = emailRef.current;
    if (input && !input.value) input.value = loadRememberedEmail();
  }, [status]);

  useEffect(() => {
    if (status === "success") confirmRef.current?.focus();
  }, [status]);

  if (status === "success")
    return (
      <div
        ref={confirmRef}
        tabIndex={-1}
        role="status"
        className="store-receipt border-gold space-y-2 border-l-2 pl-4 outline-none"
      >
        <p className="font-semibold">Listo, te avisaremos.</p>
        <p className="text-sm">
          Enviaremos un correo a{" "}
          <strong className="break-all">{savedEmail}</strong> cuando
          {variantLabel ? ` ${variantLabel}` : " esta variante"} vuelva a estar
          disponible.
        </p>
        <button
          type="button"
          className="store-link inline-flex min-h-11 items-center text-sm"
          onClick={() => {
            setServerError("");
            setStatus("idle");
          }}
        >
          Usar otro correo
        </button>
      </div>
    );

  const busy = status === "submitting";
  const hintId = ids + "-hint";
  const errorId = ids + "-error";

  return (
    <form
      className="space-y-3"
      aria-label="Avisarme cuando haya stock"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        const result = validateRestockEmail(form.get("email"));
        if (!result.ok) {
          setFieldError(result.error);
          emailRef.current?.focus();
          return;
        }
        setFieldError("");
        setServerError("");
        // Honeypot: real people never see this field, bots usually fill it.
        if (form.get("website")) {
          setSavedEmail(result.email);
          setStatus("success");
          return;
        }
        setStatus("submitting");
        try {
          await api("/restock", {
            method: "POST",
            body: JSON.stringify({
              email: result.email,
              variantId,
              reactivate: form.get("reactivate") === "on",
            }),
          });
          rememberEmail(result.email);
          setSavedEmail(result.email);
          setStatus("success");
        } catch (error) {
          setServerError(restockErrorMessage(error));
          setStatus("idle");
        }
      }}
    >
      <div>
        <label className="block" htmlFor={ids + "-email"}>
          Avísame cuando vuelva
        </label>
        <input
          ref={emailRef}
          id={ids + "-email"}
          className="store-field mt-1 block w-full border p-3"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          maxLength={254}
          placeholder="Tu correo"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${errorId} ${hintId}` : hintId}
          onChange={(e) => {
            if (!fieldError) return;
            const result = validateRestockEmail(e.currentTarget.value);
            if (result.ok) setFieldError("");
          }}
          onBlur={(e) => {
            if (!fieldError) return;
            const result = validateRestockEmail(e.currentTarget.value);
            setFieldError(result.ok ? "" : result.error);
          }}
        />
        {fieldError && (
          <p id={errorId} role="alert" className="text-sale mt-1 text-sm">
            {fieldError}
          </p>
        )}
        <p id={hintId} className="text-muted mt-1 text-sm">
          Solo te escribiremos para este aviso.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Sitio web
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="block text-sm">
        <input name="reactivate" type="checkbox" /> Reactivar mis avisos si
        antes me di de baja
      </label>
      <StoreAction type="submit" disabled={busy} aria-busy={busy}>
        {busy ? (
          <Spinner announce={false} label="Registrando…" />
        ) : (
          "Recibir aviso"
        )}
      </StoreAction>
      {serverError && (
        <p className="store-status text-sale" role="alert">
          {serverError}
        </p>
      )}
    </form>
  );
}
