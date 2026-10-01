# Módulo 4: Pedidos WhatsApp, Automatización & Restock

- **Rama sugerida:** `feat/orders-wh`
- **Módulo:** `src/modules/orders` & `src/modules/restock`
- **Alcance:** Generación de órdenes con WhatsApp, máquina de estados, expiración atómica de reservas y notificaciones automáticas por correo.

---

## Tareas y Requerimientos

### [LOG-01] Generador de Pedidos y Serializador de WhatsApp API

- **Objetivo:** Transformar el carrito en una orden persistida y redirigir al checkout conversacional.
- **Entregables:**
  - `src/modules/orders/application/CreateOrderUseCase.ts`: Registra la orden con estado inicial `PENDING_PAYMENT` y reserva provisional de existencias.
  - `src/modules/orders/infra/WhatsAppMessageSerializer.ts`: Genera un mensaje legible con resumen de productos, tallas, total y código de orden codificado en formato `https://wa.me/<telefono>?text=...`.

### [LOG-02] Máquina de Estados de Compra y Tracking de Pedidos

- **Objetivo:** Ciclo de vida estricto para cada pedido.
- **Entregables:**
  - Enum de estados: `PENDING_PAYMENT` -> `CONFIRMED` -> `SHIPPED` -> `CANCELLED`.
  - Invariantes de transición en `src/modules/orders/domain/OrderStateValidator.ts` (impedir transiciones ilegales, ej. `CANCELLED` a `SHIPPED`).
  - Vista en Backoffice `src/app/(admin)/ordenes/page.tsx` para actualización manual por operadores mediante etiquetas dinámicas.

### [LOG-03] Cron Jobs de Expiración y Liberación Atómica de Stock

- **Objetivo:** Devolver al inventario productos de órdenes impagadas cuyo tiempo de retención expire.
- **Entregables:**
  - Endpoint seguro en `src/app/api/cron/expire-holds/route.ts` protegido con Bearer token (`CRON_SECRET`).
  - `src/modules/orders/application/ExpirePendingOrdersUseCase.ts`: Busca órdenes en `PENDING_PAYMENT` vencidas (> 30-60 min) y ejecuta `$transaction` en Prisma:
    1. Marca la orden como `CANCELLED`.
    2. Suma las cantidades retenidas de nuevo a `ProductVariant.stock`.

### [LOG-04] Captura de Solicitudes (Back in Stock)

- **Objetivo:** Formulario en ficha de producto cuando una talla/color está agotada.
- **Entregables:**
  - Componente modal/input `src/modules/restock/ui/RestockForm.tsx` solicitando email al cliente.
  - Validación de email con `zod`.

### [LOG-05] Lógica y Persistencia de Solicitudes de Restock

- **Objetivo:** Repositorio y modelo para las alertas de reposición.
- **Entregables:**
  - Modelo `RestockAlert` en `prisma/schema.prisma` asociando `email`, `variantId` y flag `notified: Boolean`.
  - Endpoint en `src/app/api/v1/restock/route.ts` manejando suscripciones únicas para evitar spam.

### [LOG-06] Servicio Asíncrono de Notificaciones con Resend

- **Objetivo:** Disparar emails al detectar incremento de inventario en variantes agotadas.
- **Entregables:**
  - Plantilla con React Email en `src/server/mail/templates/RestockEmail.tsx`.
  - Integración del SDK en `src/server/mail/resend.ts`.
  - `src/modules/restock/application/NotifyBackInStockUseCase.ts`: Al actualizar el stock desde el Backoffice ([ADM-03]), si `stock` pasa de 0 a > 0, dispara el envío a los emails en cola y actualiza `notified = true`.

---

## Estructura del Módulo

```text
src/
├── app/
│   ├── api/cron/expire-holds/route.ts
│   └── api/v1/restock/route.ts
├── modules/orders/
│   ├── application/
│   │   ├── CreateOrderUseCase.ts
│   │   └── ExpirePendingOrdersUseCase.ts
│   ├── domain/
│   │   ├── Order.ts
│   │   └── OrderStatus.ts
│   └── infra/
│       ├── PrismaOrderRepository.ts
│       └── WhatsAppMessageSerializer.ts
└── modules/restock/
    ├── application/NotifyBackInStockUseCase.ts
    ├── domain/RestockSubscription.ts
    └── infra/PrismaRestockRepository.ts
```

## Checklist de Verificación

[ ] La serialización de WhatsApp codifica acentos, saltos de línea (%0A) y caracteres especiales correctamente.

[ ] La liberación de stock en el cron corre dentro de prisma.$transaction para evitar inconsistencias de inventario.

[ ] El endpoint del cron rechaza requests sin la cabecera Authorization: Bearer ${CRON_SECRET}.

[ ] Las notificaciones de Resend se ejecutan en segundo plano sin ralentizar la respuesta de actualización de stock en el panel admin.
