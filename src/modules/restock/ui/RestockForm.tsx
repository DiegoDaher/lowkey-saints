"use client";
import { useEffect, useId, useRef, useState } from "react";
import Spinner from "@/components/ui/Spinner";
import StoreAction from "@/components/ui/StoreAction";
import { api } from "@/lib/api";
import {
  loadRememberedEmail,
  parseRestockResult,
  rememberEmail,
  restockConfirmation,
  restockErrorMessage,
  restockNeedsReload,
  validateRestockEmail,
  type RestockResult,
} from "../domain/restock-form";

type Done = Exclude<RestockResult, "unsubscribed">;
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirm"; email: string; busy: boolean }
  | { kind: "success"; email: string; result: Done };

/**
 * Back-in-stock request for a sold-out variant (LOG-04 / LOG-05).
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");
  const [needsReload, setNeedsReload] = useState(false);

  // Prefill after mount so server and client render the same markup.
  useEffect(() => {
    const input = emailRef.current;
    if (input && !input.value) input.value = loadRememberedEmail();
  }, [status.kind]);

  // Move focus to the confirmation or the reactivation question.
  useEffect(() => {
    if (status.kind === "success" || status.kind === "confirm")
      panelRef.current?.focus();
  }, [status.kind]);

  async function request(email: string, reactivate: boolean) {
    setServerError("");
    setNeedsReload(false);
    try {
      const result = parseRestockResult(
        await api("/restock", {
          method: "POST",
          body: JSON.stringify({ email, variantId, reactivate }),
        })
      );
      rememberEmail(email);
      setStatus(
        result === "unsubscribed"
          ? { kind: "confirm", email, busy: false }
          : { kind: "success", email, result }
      );
    } catch (error) {
      setServerError(restockErrorMessage(error));
      setNeedsReload(restockNeedsReload(error));
      setStatus(
        reactivate ? { kind: "confirm", email, busy: false } : { kind: "idle" }
      );
    }
  }

  const reset = () => {
    setServerError("");
    setNeedsReload(false);
    setStatus({ kind: "idle" });
  };

  const errorBox = serverError && (
    <div className="store-status text-sale space-y-1" role="alert">
      <p>{serverError}</p>
      {needsReload && (
        <button
          type="button"
          className="store-link inline-flex min-h-11 items-center text-sm"
          onClick={() => window.location.reload()}
        >
          Recargar página
        </button>
      )}
    </div>
  );

  if (status.kind === "success") {
    const copy = restockConfirmation(status.result, status.email, variantLabel);
    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        role="status"
        className="store-receipt border-gold space-y-2 border-l-2 pl-4 outline-none"
      >
        <p className="font-semibold">{copy.title}</p>
        <p className="text-sm break-words">{copy.body}</p>
        <button
          type="button"
          className="store-link inline-flex min-h-11 items-center text-sm"
          onClick={reset}
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  if (status.kind === "confirm")
    return (
      <div className="space-y-3">
        <div
          ref={panelRef}
          tabIndex={-1}
          role="status"
          className="border-gold space-y-2 border-l-2 pl-4 outline-none"
        >
          <p className="font-semibold">Antes cancelaste estos avisos.</p>
          <p className="text-sm">
            <strong className="break-all">{status.email}</strong> se dio de baja
            de los avisos de {variantLabel ?? "esta variante"}. ¿Quieres
            reactivarlos?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StoreAction
            type="button"
            disabled={status.busy}
            aria-busy={status.busy}
            onClick={() => {
              if (status.busy) return;
              setStatus({ ...status, busy: true });
              void request(status.email, true);
            }}
          >
            {status.busy ? (
              <Spinner announce={false} label="Reactivando…" />
            ) : (
              "Reactivar avisos"
            )}
          </StoreAction>
          <button
            type="button"
            className="store-link inline-flex min-h-11 items-center text-sm"
            disabled={status.busy}
            onClick={reset}
          >
            Usar otro correo
          </button>
        </div>
        {errorBox}
      </div>
    );

  const busy = status.kind === "submitting";
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
        // Honeypot: real people never see this field, bots usually fill it.
        if (form.get("website")) {
          setStatus({
            kind: "success",
            email: result.email,
            result: "created",
          });
          return;
        }
        setStatus({ kind: "submitting" });
        await request(result.email, false);
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
          Solo te escribiremos para este aviso. Puedes cancelarlo desde el
          correo.
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
      <StoreAction type="submit" disabled={busy} aria-busy={busy}>
        {busy ? (
          <Spinner announce={false} label="Registrando…" />
        ) : (
          "Recibir aviso"
        )}
      </StoreAction>
      {errorBox}
    </form>
  );
}
