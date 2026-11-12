export interface WhatsAppOrder {
  orderNumber: number;
  clientName: string;
  totalAmount: { toFixed(decimalPlaces: number): string };
  currency: string;
  expiresAt: Date;
  items: readonly {
    quantity: number;
    productName: string;
    size: string;
    color: string;
  }[];
}

export class WhatsAppMessageSerializer {
  /** The caller validates the commercial phone before reserving inventory. */
  serialize(phone: string, order: WhatsAppOrder): string {
    const message = [
      "Hola, mi pedido es #" + order.orderNumber,
      order.clientName,
      ...order.items.map(
        (item) =>
          `${item.quantity} × ${item.productName} / ${item.size} / ${item.color}`
      ),
      `Total: $${order.totalAmount.toFixed(2)} ${order.currency}`,
      "Reserva hasta " + order.expiresAt.toISOString(),
    ].join("\n");
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }
}
