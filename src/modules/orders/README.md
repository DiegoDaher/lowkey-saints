# Módulo 4: Pedidos WhatsApp, Automatización & Restock

- **Responsable:** Desarrollador 4
- **Rama:** `feature/orders-whatsapp-restock`
- **Alcance:** Generación de órdenes vía WhatsApp, control de estados, cancelación automática por tiempo y alertas de reposición.

---

## Reglas de Arquitectura

- El cron job bajo `api/cron/` debe ser idempotente y seguro ante ejecuciones concurrentes.
- El envío de correos debe ser tolerante a fallos (no revertir la transacción de inventario si el servicio de correo falla temporalmente).
