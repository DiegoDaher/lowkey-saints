"use client";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { holdRemaining } from "@/modules/orders/domain/cart";

/** Re-renders every 15 s so the remaining minutes stay current. */
export function useHoldCountdown(heldAt: number | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (heldAt === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [heldAt]);
  if (heldAt === null || now === null) return null;
  return holdRemaining(heldAt, now);
}

export default function HoldNotice({ heldAt }: { heldAt: number | null }) {
  const remaining = useHoldCountdown(heldAt);
  if (remaining === null) return null;
  const minutes = Math.ceil(remaining / 60_000);
  const expired = remaining === 0;
  return (
    <p
      className={`store-hold flex items-start gap-2 text-sm ${expired ? "store-hold--expired" : ""}`}
      data-testid="hold-notice"
    >
      <Clock aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
      {expired ? (
        <span>
          Tu selección ya no está apartada. La disponibilidad se confirma al
          crear tu pedido.
        </span>
      ) : (
        <span>
          Apartamos tu selección por{" "}
          <strong>
            {minutes} {minutes === 1 ? "minuto" : "minutos"}
          </strong>
          . Crea tu pedido para reservarla 24 horas.
        </span>
      )}
    </p>
  );
}
