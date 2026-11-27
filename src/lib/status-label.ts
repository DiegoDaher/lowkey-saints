const labels: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  CONFIRMED: "Confirmado",
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
/** Restock notification states (LOG-06), kept apart from order labels. */
const notificationLabels: Record<string, string> = {
  PENDING: "En cola",
  PROCESSING: "Enviando",
  SENT: "Enviado",
  FAILED: "Requiere revisión",
  CANCELLED: "Cancelado",
};
export const notificationLabel = (status: string) =>
  notificationLabels[status] ?? status;
