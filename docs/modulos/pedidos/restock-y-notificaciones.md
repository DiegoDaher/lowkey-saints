# Restock y notificaciones por correo

> Tickets: **LOG-04** (formulario), **LOG-05** (suscripciones) y **LOG-06** (envío con Resend) · Módulo: [Pedidos y restock](./README.md)
> Rutas: ficha de producto (formulario), `/baja` (baja pública), `/140210/restock` (solo ADMIN, permiso `restock`)

Cuando una talla o color está agotado, el comprador deja su correo. Al reponerse el stock, se encola un aviso y el worker `jobs` lo envía con Resend.

> **Diferencias con la especificación original:** no existen `RestockAlert`, `src/app/api/v1/restock/route.ts` ni `src/server/mail`. El backend vive en Supabase Edge Functions; `RestockSubscription` y `Notification` cubren el modelo, y el correo se envía con un adaptador `fetch` (sin SDK de Resend ni React Email).

## Flujo completo

```text
Ficha (agotado) ─RestockForm─▶ POST /v1/restock ─▶ RestockSubscription (ACTIVE)
                                                         │
Stock 0 → >0 / desarchivar ─NotifyBackInStockUseCase─▶ Notification (PENDING)   ← misma transacción (outbox)
                                                         │
pg_cron cada minuto ─▶ jobs ─DeliverRestockNotificationsUseCase─▶ Resend ─▶ SENT / FAILED
                                                         │
Correo ─ enlace /baja?token=… o List-Unsubscribe one-click ─▶ UNSUBSCRIBED
```

## 1. Formulario «Avísame cuando vuelva» (LOG-04)

- `src/modules/restock/ui/RestockForm.tsx`: formulario en línea bajo el botón deshabilitado cuando `checkStock(...).reason === "out_of_stock"`. Se monta con `key={variantId}` para reiniciarse al cambiar de variante.
- Valida con `restockEmailSchema` (deriva de `subscriptionInput` en `_shared/contracts.ts`), así el cliente y la API aplican la misma regla.
- Errores junto al campo (`aria-invalid`) y mensajes en español para 400, 409 y 429. En 404/409 ofrece «Recargar página».
- Recuerda el último correo en `localStorage` (`restock-email`) y usa un honeypot (`website`) que nunca llega a la API.
- Estados: formulario → enviando → «Listo, te avisaremos» / «Ya estabas en la lista» / «Avisos reactivados». Si la API responde `unsubscribed`, pregunta «¿Quieres reactivarlos?» y reenvía con `reactivate: true`.
- Lógica pura en `src/modules/restock/domain/restock-form.ts`. Acepta la respuesta antigua `{ ok: true }`, así que el orden de despliegue entre frontend y API no importa.

## 2. Suscripciones (LOG-05)

`RestockSubscription`: única por `(email, variantId)`, con estado `ACTIVE`, `NOTIFIED` o `UNSUBSCRIBED`, un contador `generation` y un `unsubscribeToken`.

Regla (`_shared/restock/domain/RestockSubscriptionPolicy.ts`):

| Estado previo  | Resultado                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| No existe      | Se crea (`created`)                                                                                   |
| `ACTIVE`       | No cambia (`active`, idempotente)                                                                     |
| `NOTIFIED`     | Se reactiva para el siguiente reabasto (`reactivated`)                                                |
| `UNSUBSCRIBED` | Solo se reactiva con `reactivate: true` (consentimiento explícito); si no, `unsubscribed` sin cambios |

`SubscribeToRestockUseCase` la aplica en una transacción serializable. Reactivar incrementa `generation` y rota `unsubscribeToken`. Una carrera de inserción (P2002) se responde como duplicado, no como error.

## 3. Cola y envío (LOG-06)

### Encolar

`NotifyBackInStockUseCase` crea un `Notification` por cada suscripción `ACTIVE` (único por suscripción y generación) y revive la fila `CANCELLED` de la generación vigente. Se invoca dentro de la transacción de:

- `updateStock` cuando una variante pasa de 0 a más de 0;
- la cancelación de un pedido (manual o por expiración) que devuelve stock a una variante agotada;
- `PATCH` de producto o variante, o `PUT` de producto, al desarchivar con stock.

### Entregar

`DeliverRestockNotificationsUseCase` (worker `jobs`, hasta 25 por ejecución):

- Recupera filas `PROCESSING` bloqueadas más de 5 minutos (worker caído).
- Cancela el aviso si la suscripción ya no está activa, cambió de generación o la variante o el producto están archivados.
- Si la variante volvió a agotarse, espera 15 minutos **sin consumir un intento**.
- Cuenta el intento justo antes del POST; el primero fija `firstAttemptAt`, que abre la ventana de idempotencia de Resend.
- El correo (`_shared/restock/infra/RestockEmail.ts`) es HTML + texto con datos escapados, enlace al producto y a `/baja?token=…`, y cabeceras `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058).

Reglas puras (`_shared/restock/domain/NotificationDeliveryPolicy.ts`):

| Regla                    | Valor                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Intentos máximos         | 5                                                                                                                      |
| Backoff                  | `min(60, 2^n)` minutos                                                                                                 |
| Ventana de idempotencia  | 23 h desde `firstAttemptAt`; fuera de ella la entrega es incierta → `FAILED` («revisar proveedor antes de reintentar») |
| Errores permanentes      | HTTP 400, 401, 403, 422 → `FAILED` de inmediato                                                                        |
| Espera por stock agotado | 15 min, sin contar intento                                                                                             |

Estados de `Notification`: `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`. Al enviarse, la suscripción pasa a `NOTIFIED`.

### Reintentos desde el Backoffice

`RetryRestockNotificationUseCase`: reintento individual de un `FAILED` (con `force` si la entrega es incierta y el operador lo confirma) y reintento masivo, que solo incluye los seguros (`ready`; los `needs-confirmation` se excluyen).

## Baja

- `/baja?token=…` (`src/app/(store)/baja/page.tsx`) confirma la baja y enlaza a la tienda; explica qué hacer si falta el token.
- Los clientes de correo pueden darse de baja con un clic: `POST /v1/unsubscribe/one-click?token=…`. Un `GET` a esa URL redirige (303) a `/baja`.
- La baja marca la suscripción como `UNSUBSCRIBED` y cancela sus avisos `PENDING` o `FAILED` en la misma transacción. Un token desconocido no produce error. Una baja nunca se reactiva sola.

## Panel de reposición (`/140210/restock`)

`src/components/admin/RestockWorkspace.tsx` con lógica pura en `src/modules/restock/domain/restock-admin.ts`:

- Chips con conteos por estado del aviso que filtran al hacer clic, búsqueda por correo o producto, y filtros de suscripción y aviso.
- Estados en lenguaje claro: «Esperando stock», «En cola · Próximo intento», «Enviado el…», «Requiere revisión: motivo».
- Botón «Reintentar» por aviso, «Reintentar todos los fallidos» y «Página X de N».
- Acepta la respuesta antigua en arreglo, así que el orden de despliegue no importa.

## Contratos API

Prefijo: `/functions/v1/api/v1`.

| Método y ruta                        | Acceso          | Contrato                                                                                                                                                              |
| ------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /restock`                      | Público         | `{ email, variantId, reactivate? }` → 201 `created`; 200 `active` / `reactivated` / `unsubscribed`; 404 variante inexistente o archivada; 409 la variante tiene stock |
| `POST /unsubscribe`                  | Público         | `{ token }` → `{ ok: true }`                                                                                                                                          |
| `POST /unsubscribe/one-click?token=` | Público         | Baja RFC 8058; solo aplica el límite global                                                                                                                           |
| `GET /admin/restock`                 | ADMIN `restock` | `page`, `status`, `delivery`, `q` → `{ items, total, page, pages, counts }`                                                                                           |
| `POST /admin/restock/retry`          | ADMIN `restock` | `{ notificationId, force? }`; 409 si no es `FAILED` o falta confirmar un posible duplicado                                                                            |
| `POST /admin/restock/retry-failed`   | ADMIN `restock` | Reintenta todos los `FAILED` seguros → `{ count }`                                                                                                                    |

Límites de `POST /restock`: 5 por correo (hash) y 20 por IP, además del global. La respuesta revela si un correo ya está suscrito a una variante; se acepta porque no expone otros datos y está limitada.

## Datos y migraciones

- `RestockSubscription` y `Notification` existen desde la migración inicial.
- `202611260001_restock_delivery` añade `Notification.firstAttemptAt` (backfill con `createdAt` cuando `attempts > 0`). Aplicarla **antes** de desplegar `api` y `jobs`.

## Configuración

| Variable                        | Dónde         | Uso                                                               |
| ------------------------------- | ------------- | ----------------------------------------------------------------- |
| `RESEND_API_KEY`, `RESEND_FROM` | `jobs`        | Credenciales y remitente de Resend                                |
| `SITE_URL`                      | `jobs`, `api` | Origen `https://` de la tienda para enlaces y redirección de baja |

Sin estas variables el worker no envía nada (`mailConfigured: false`) y los avisos quedan en cola. Que el código exista no demuestra entrega real: verificarla en staging.

## Código

```text
src/modules/restock/
├── domain/restock-form.ts    # validación compartida, mensajes, resultado de la API, recordar correo
├── domain/restock-admin.ts   # filtros, etiquetas y textos del panel de reposición
└── ui/RestockForm.tsx        # formulario en línea (cliente)

supabase/functions/_shared/restock/
├── domain/RestockSubscriptionPolicy.ts
├── domain/NotificationDeliveryPolicy.ts
├── application/SubscribeToRestockUseCase.ts
├── application/NotifyBackInStockUseCase.ts
├── application/DeliverRestockNotificationsUseCase.ts
├── application/RetryRestockNotificationUseCase.ts
├── infra/ResendMailer.ts     # adaptador fetch, inyectable en pruebas
└── infra/RestockEmail.ts     # correo HTML + texto
```

## Pruebas

- Unitarias: `tests/restock-form.test.ts`, `restock-subscription.test.ts`, `restock-email.test.ts`, `restock-delivery-policy.test.ts`, `restock-admin.test.ts`.
- Navegador: grupo «restock form (LOG-04)» en `tests/pdp-variants.browser.spec.ts`, `/baja` en `tests/loader.browser.spec.ts` y «restock filters, counts and retries failed notices (LOG-06)» en `tests/admin-dashboard.browser.spec.ts`.
- Integración (`tests/integration.ts`): resultados 201/200/404/409, carrera concurrente, reactivación con rotación de token, correo HTML y `List-Unsubscribe`, espera sin intentos, entrega después de 23 h, 422 inmediato, reintentos con y sin confirmación, masivo, desarchivar variante o producto, baja no revivida, listado con filtros y one-click POST/GET.
