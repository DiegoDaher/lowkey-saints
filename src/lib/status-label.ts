const labels: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  CONFIRMED: "Pago confirmado",
  SHIPPED: "Enviado",
  CANCELLED: "Cancelado",
  ACTIVE: "Activa",
  NOTIFIED: "Aviso enviado",
  UNSUBSCRIBED: "Baja solicitada",
  PENDING: "Pendiente",
  PROCESSING: "En proceso",
  SENT: "Enviado",
  FAILED: "Requiere revisión",
};
export const statusLabel = (status: string) => labels[status] ?? status;
