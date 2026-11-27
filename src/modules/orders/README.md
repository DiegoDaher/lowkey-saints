# Módulo 4: Pedidos WhatsApp, Automatización & Restock

- **Rama sugerida:** `feat/orders-wh`
- **Módulo:** `src/modules/orders` & `src/modules/restock`
- **Alcance:** Generación de órdenes con WhatsApp, máquina de estados, expiración atómica de reservas y notificaciones automáticas por correo.

---

## Tareas y Requerimientos

### [LOG-01] Generador de Pedidos y Serializador de WhatsApp API

- **Objetivo:** Transformar el carrito en una orden persistida y redirigir al checkout conversacional.
- **Entregables:**
  - `supabase/functions/_shared/orders/application/CreateOrderUseCase.ts`: Registra la orden con estado explícito `PENDING_PAYMENT`, moneda `MXN` y reserva de existencias durante **24 horas**. Consulta precios en la base de datos y guarda datos históricos de los artículos. La reserva y la orden se confirman en una transacción serializable, con reintentos e idempotencia.
  - `supabase/functions/_shared/orders/infra/WhatsAppMessageSerializer.ts`: Serializador puro que recibe el teléfono comercial validado y el pedido persistido. Genera `https://wa.me/<telefono>?text=...` con número de pedido, comprador, cantidades, productos, tallas, colores, total y vencimiento ISO.

El backend de LOG-01 vive en Supabase Edge Functions. `ShopService.createOrder` delega en el caso de uso y `POST /v1/orders` conserva su contrato y valida `WHATSAPP_PHONE` antes de reservar. No requiere migraciones ni dependencias nuevas.

El checkout permanece en `/bolsa`: tras crear el pedido se muestra **Continuar en WhatsApp**. El comprador envía el mensaje desde WhatsApp. Ante errores se conservan el carrito y la clave de idempotencia para reintentar; el carrito se limpia únicamente tras una respuesta exitosa.

LOG-01 no incluye un carrito lateral nuevo ni modifica estados posteriores, cron o notificaciones de restock. La duración implementada es de 24 horas; la referencia de 30–60 minutos de LOG-03 no se aplica a este trabajo.

Verificación: `npm run test:unit`, `npm run test:integration` (PostgreSQL local desechable), `npm run test:browser` (tienda local en puerto 3000), `npm run lint`, `npm run check-types` y `npm run check:edge`. Las pruebas de navegador simulan la API; la persistencia y concurrencia se verifican en integración.

Validación local de LOG-01 (2026-10-28): 6 pruebas unitarias y 3 de navegador aprobadas; lint, tipos y `check:edge` aprobados. La integración queda **pendiente**, porque PostgreSQL en `127.0.0.1:55439` rechazó la conexión y el motor de Docker no estaba activo. El archivo de integración pasó `deno check`, lo que no sustituye su ejecución contra PostgreSQL. No se desplegó a producción.

### [LOG-02] Estados e historial de pedidos

Implementado sobre Supabase Edge Functions y la pantalla `/admin/ordenes`. Conserva los cuatro estados existentes, permite cancelar solamente pendientes y registra los cambios efectivos en un historial transaccional de solo insercion. La API calcula las acciones disponibles; el Backoffice muestra etiquetas, confirmaciones, filtro, paginacion e historial, con refresco cada 30 segundos.

Rutas adaptadas a la arquitectura real: `supabase/functions/_shared/orders/domain/OrderStateValidator.ts` y `src/app/admin/ordenes/page.tsx`. La migracion `202611110001_order_history` agrega el historial sin reconstruir eventos antiguos. Ver [reglas, contratos, pruebas y despliegue](../../../docs/log-02.md).

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

**Estado: implementado.** `src/modules/restock/ui/RestockForm.tsx` es un formulario en línea que aparece bajo el CTA deshabilitado cuando `checkStock(...).reason === "out_of_stock"`. Valida con `restockEmailSchema` (`subscriptionInput.pick({ email: true })` de `_shared/contracts.ts`), así cliente y API aplican la misma regla. Envía a `POST /v1/restock` y muestra el error junto al campo (`aria-invalid`), mensajes en español para 409/429/400 y una confirmación con el correo y la opción "Usar otro correo". Recuerda el último correo en `localStorage` (`restock-email`) y usa un honeypot (`website`) que nunca llega a la API. La lógica pura está en `src/modules/restock/domain/restock-form.ts`. No requiere migraciones ni cambios de backend.

Verificación: `tests/restock-form.test.ts` (unitarias) y el grupo "restock form (LOG-04)" en `tests/pdp-variants.browser.spec.ts`.

### [LOG-05] Lógica y Persistencia de Solicitudes de Restock

- **Objetivo:** Repositorio y modelo para las alertas de reposición.
- **Entregables:**
  - Modelo `RestockAlert` en `prisma/schema.prisma` asociando `email`, `variantId` y flag `notified: Boolean`.
  - Endpoint en `src/app/api/v1/restock/route.ts` manejando suscripciones únicas para evitar spam.

**Estado: implementado (adaptado a Supabase).** No se creó `RestockAlert` ni `src/app/api/v1/restock/route.ts`: el backend vive en Supabase Edge Functions. `RestockSubscription` (`@@unique([email, variantId])`, estados ACTIVE/NOTIFIED/UNSUBSCRIBED, `generation`, `unsubscribeToken`) cubre el modelo, y `POST /v1/restock` en `supabase/functions/api/handler.ts` mantiene el límite de 5 solicitudes por minuto por correo y 20 por IP. Sin migraciones.

- `supabase/functions/_shared/restock/domain/RestockSubscriptionPolicy.ts`: regla pura de una suscripción por correo y variante. Nueva → se crea; ACTIVE → no cambia (idempotente); NOTIFIED → se reactiva sola para el siguiente reabasto; UNSUBSCRIBED → solo se reactiva con `reactivate: true` (consentimiento explícito).
- `supabase/functions/_shared/restock/application/SubscribeToRestockUseCase.ts`: aplica la regla en una transacción serializable. Reactivar sube `generation` y rota `unsubscribeToken`. Una carrera de inserción (P2002) se responde como duplicado, no como error.
- `supabase/functions/_shared/restock/infra/RestockEmail.ts`: correo HTML + texto con datos escapados. `DeliverRestockNotificationsUseCase` lo usa (LOG-06).

| Caso                                                                | HTTP | Respuesta                                     |
| ------------------------------------------------------------------- | ---- | --------------------------------------------- |
| Nueva suscripción                                                   | 201  | `{ result: "created" }`                       |
| Ya activa                                                           | 200  | `{ result: "active" }`                        |
| Reactivada (tras aviso enviado, o tras baja con `reactivate: true`) | 200  | `{ result: "reactivated" }`                   |
| Dada de baja, sin `reactivate`                                      | 200  | `{ result: "unsubscribed" }` (no cambia nada) |
| Variante inexistente o archivada                                    | 404  | error                                         |
| Variante con stock                                                  | 409  | error                                         |

El resultado indica si un correo ya está suscrito a una variante. Se acepta porque no expone otros datos y está limitado por correo e IP.

UI: el formulario ya no muestra la casilla "Reactivar". Si la API responde `unsubscribed`, pregunta "¿Quieres reactivarlos?" y reenvía con `reactivate: true`. Distingue "Listo, te avisaremos", "Ya estabas en la lista" y "Avisos reactivados". En 404/409 ofrece "Recargar página". Acepta la respuesta antigua `{ ok: true }`, así que el orden de despliegue de front y Supabase no importa. `/baja` explica qué hacer cuando falta el token y confirma la baja con un enlace a la tienda.

Verificación: `tests/restock-subscription.test.ts`, `tests/restock-email.test.ts`, `tests/restock-form.test.ts`, la sección restock de `tests/integration.ts` (resultados, 404/409, carrera concurrente, reactivación con rotación de token, correo HTML y `List-Unsubscribe`, y respuestas HTTP 201/200/404/409), el grupo "restock form (LOG-04)" de `tests/pdp-variants.browser.spec.ts` y las pruebas de `/baja` en `tests/loader.browser.spec.ts`.

### [LOG-06] Servicio Asíncrono de Notificaciones con Resend

- **Objetivo:** Disparar emails al detectar incremento de inventario en variantes agotadas.
- **Especificación original:** plantilla React Email en `src/server/mail`, SDK de Resend y `NotifyBackInStockUseCase` con `notified = true`.

**Estado: implementado (adaptado a Supabase).** El envío ya era asíncrono: `Notification` es una cola outbox y Supabase Cron llama a `supabase/functions/jobs` cada minuto. No se creó `src/server/mail`; React Email y el SDK `resend` se retiraron de `package.json` porque el bundle de Deno usa un adaptador `fetch` (decisión de LOG-05). `notified = true` lo cubren `RestockSubscription.status = NOTIFIED` y `generation`.

- `_shared/restock/domain/NotificationDeliveryPolicy.ts`: reglas puras. Backoff `min(60, 2^n)` min, máximo 5 intentos, ventana de idempotencia de 23 h, errores permanentes (400/401/403/422) y elegibilidad de reintento (`ready` / `needs-confirmation`).
- `_shared/restock/application/NotifyBackInStockUseCase.ts`: encola por suscripción ACTIVE y revive la fila CANCELLED de la generación vigente. Lo usan `updateStock` (0 → >0), la cancelación de pedidos, `PATCH` de producto/variante y `PUT` de producto al desarchivar con stock.
- `_shared/restock/application/DeliverRestockNotificationsUseCase.ts`: reemplaza a `_shared/notifications.ts`. Esperar stock ya no suma `attempts`; el intento se cuenta justo antes del POST y `firstAttemptAt` abre la ventana. Agrega `List-Unsubscribe` + `List-Unsubscribe-Post`.
- `_shared/restock/application/RetryRestockNotificationUseCase.ts`: reintento individual (con `force` fuera de la ventana) y masivo (solo los seguros).
- `_shared/restock/infra/ResendMailer.ts`: adaptador `fetch` inyectable en pruebas.
- Migración `202611260001_restock_delivery`: columna `Notification.firstAttemptAt` (backfill `createdAt` si `attempts > 0`).

| Endpoint                                 | Uso                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /v1/admin/restock`                  | `page`, `status`, `delivery`, `q` → `{ items, total, page, pages, counts }`           |
| `POST /v1/admin/restock/retry`           | `{ notificationId, force? }`; 409 si no es FAILED o falta confirmar posible duplicado |
| `POST /v1/admin/restock/retry-failed`    | Reintenta todos los FAILED seguros → `{ count }`                                      |
| `POST /v1/unsubscribe/one-click?token=…` | Baja RFC 8058 desde el cliente de correo; GET redirige a `/baja`                      |

Backoffice (`src/components/admin/RestockWorkspace.tsx`): chips con conteos por estado del aviso que filtran al hacer clic, búsqueda por correo o producto, filtros de suscripción y aviso, columnas de fecha y estado en lenguaje claro ("Esperando stock", "En cola · Próximo intento", "Enviado el…", "Requiere revisión: motivo"), botón Reintentar por aviso, "Reintentar todos los fallidos" y "Página X de N". Acepta la respuesta antigua en arreglo, así que no importa el orden de despliegue. Lógica pura en `src/modules/restock/domain/restock-admin.ts`.

Despliegue: aplicar la migración antes de desplegar las funciones `api` y `jobs`.

Verificación: `tests/restock-delivery-policy.test.ts`, `tests/restock-admin.test.ts`, la sección LOG-06 de `tests/integration.ts` (espera sin intentos, espera de más de 23 h entregada, 422 inmediato, reintentos con y sin confirmación, masivo, desarchivar variante/producto, baja no revivida, listado con filtros, one-click POST/GET) y "restock filters, counts and retries failed notices (LOG-06)" en `tests/admin-dashboard.browser.spec.ts`.

---

## Estructura del Módulo

La estructura siguiente corresponde a la propuesta original del módulo completo. Para LOG-01, las rutas implementadas son las de Supabase indicadas arriba.

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
