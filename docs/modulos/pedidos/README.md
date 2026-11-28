# Pedidos, automatización y restock

> Módulo 4 · Prefijo de tickets **LOG** · Responsable: Diego Daher Díaz Contreras

Convierte la bolsa en un pedido con stock reservado y enlace de WhatsApp, gestiona los estados del pedido desde el Backoffice, libera las reservas vencidas con un worker programado y avisa por correo cuando vuelve el stock de una variante agotada.

## Documentación del módulo

| Funcionalidad                                              | Qué cubre                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Creación de pedidos y WhatsApp](./creacion-y-whatsapp.md) | Checkout en `/bolsa`, reserva de 24 h, precio en servidor, idempotencia, `wa.me`    |
| [Estados e historial](./estados-e-historial.md)            | Máquina de estados, consola de órdenes, historial de solo inserción                 |
| [Expiración y worker `jobs`](./expiracion-y-stock.md)      | pg_cron + Vault, cancelación de reservas vencidas, devolución de stock              |
| [Restock y notificaciones](./restock-y-notificaciones.md)  | Formulario, suscripciones, cola outbox, envío con Resend, baja, panel de reposición |

## Ciclo de vida de un pedido

```text
/bolsa ──POST /v1/orders──▶ PENDING_PAYMENT (stock reservado 24 h) ──enlace wa.me──▶ el comprador escribe por WhatsApp
                                  │
             ┌────────────────────┼─────────────────────────┐
   operador confirma pago   operador cancela        jobs: reserva vencida
             ▼                    ▼                         ▼
         CONFIRMED            CANCELLED ◀───────────── CANCELLED (EXPIRATION)
             │                    └── devuelve stock; si la variante estaba agotada → avisos de restock
     operador envía
             ▼
          SHIPPED
```

## Rutas

| Ruta              | Acceso                       | Documento                                       |
| ----------------- | ---------------------------- | ----------------------------------------------- |
| `/bolsa`          | Público                      | [Creación de pedidos](./creacion-y-whatsapp.md) |
| Ficha de producto | Público (formulario restock) | [Restock](./restock-y-notificaciones.md)        |
| `/baja`           | Público                      | [Restock](./restock-y-notificaciones.md#baja)   |
| `/140210/ordenes` | ADMIN, OPERATOR (`orders`)   | [Estados e historial](./estados-e-historial.md) |
| `/140210/restock` | ADMIN (`restock`)            | [Restock](./restock-y-notificaciones.md)        |

Endpoints de API: `POST /v1/orders`, `POST /v1/restock`, `POST /v1/unsubscribe[/one-click]`, `GET|PATCH /v1/admin/orders…` y `GET|POST /v1/admin/restock…`. El detalle está en cada página.

## Mapa de código

```text
src/app/(store)/bolsa/page.tsx               # checkout y recibo con enlace de WhatsApp
src/app/(store)/baja/page.tsx                # baja de avisos
src/modules/orders/
  domain/cart.ts                             # reglas de la bolsa (PDP-04, ver ficha de producto)
  ui/components/                             # CartItemRow, HoldNotice
src/modules/restock/                         # formulario y lógica pura del panel de reposición
src/components/admin/OrdersConsole.tsx       # consola de órdenes
src/components/admin/RestockWorkspace.tsx    # panel de reposición
supabase/functions/
  api/handler.ts                             # rutas, límites de peticiones, autorización
  jobs/index.ts                              # worker programado
  _shared/service.ts                         # ShopService: transacciones, transition, expire, updateStock
  _shared/orders/
    application/CreateOrderUseCase.ts
    domain/OrderStateValidator.ts
    infra/WhatsAppMessageSerializer.ts
  _shared/restock/                           # dominio, casos de uso e infraestructura de avisos
prisma/migrations/
  202610150003_jobs                          # lowkey_run_jobs() para pg_cron
  202611110001_order_history
  202611260001_restock_delivery
scripts/deploy-supabase.mjs                  # despliegue de funciones, Vault y cron
scripts/check-order-data.mjs                 # inspección de solo lectura antes de migrar
```

## Datos

| Modelo                | Propósito                                                                  |
| --------------------- | -------------------------------------------------------------------------- |
| `Order`               | Pedido: número, estado, total, cliente, `expiresAt`, clave de idempotencia |
| `OrderItem`           | Líneas con copias históricas (nombre, SKU, talla, color, precio)           |
| `OrderStatusHistory`  | Eventos de estado (`CHECKOUT`, `MANUAL`, `EXPIRATION`) de solo inserción   |
| `RestockSubscription` | Suscripción por correo y variante, con generación y token de baja          |
| `Notification`        | Cola outbox de avisos, con intentos, backoff y bloqueo                     |

Esquema completo en [Base de datos](../../general/base-de-datos.md).

## Configuración

| Variable                                    | Dónde                                | Uso                                            |
| ------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `WHATSAPP_PHONE`                            | `api`                                | Teléfono comercial del enlace `wa.me`          |
| `RATE_LIMIT_SECRET`                         | `api`                                | Claves de límite de peticiones (sin ella, 503) |
| `JOB_SECRET`                                | `jobs` y Vault                       | Autenticación del cron                         |
| `RESEND_API_KEY`, `RESEND_FROM`, `SITE_URL` | `jobs` (`SITE_URL` también en `api`) | Envío de avisos y enlaces de baja              |

## Trazabilidad de tickets

| Ticket | Alcance                                   | Documento                                             | Estado                                                     |
| ------ | ----------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| LOG-01 | Generador de pedidos y enlace de WhatsApp | [Creación de pedidos](./creacion-y-whatsapp.md)       | Implementado                                               |
| LOG-02 | Estados e historial de pedidos            | [Estados e historial](./estados-e-historial.md)       | Implementado                                               |
| LOG-03 | Expiración y liberación atómica de stock  | [Expiración y worker `jobs`](./expiracion-y-stock.md) | Implementado (en Supabase, reserva de 24 h)                |
| LOG-04 | Formulario «Avísame cuando vuelva»        | [Restock](./restock-y-notificaciones.md)              | Implementado                                               |
| LOG-05 | Suscripciones de restock                  | [Restock](./restock-y-notificaciones.md)              | Implementado                                               |
| LOG-06 | Envío asíncrono con Resend                | [Restock](./restock-y-notificaciones.md)              | Implementado; la entrega real depende de configurar Resend |

Fuera de alcance: WhatsApp Business API, pagos en línea, seguimiento público, paqueterías, reembolsos y notificaciones de estado al comprador.

## Verificación del módulo

```bash
npm run test:unit
npm run test:integration   # PostgreSQL local desechable (127.0.0.1:55439 o TEST_DATABASE_URL)
npm run test:browser
npm run lint
npm run check-types
npm run check:edge
npm run build
```

Pruebas del módulo: `domain`, `order-state`, `cart`, `restock-*` (`*.test.ts`); `shop`, `orders`, `pdp-variants` (grupo restock), `loader` (`/baja`) y `admin-dashboard` (grupo restock) (`*.browser.spec.ts`); y las secciones de pedidos, expiración y restock de `tests/integration.ts`.

## Despliegue

Orden general: **migraciones → `api` y `jobs` juntos → frontend**. `npm run supabase:deploy` publica las funciones, comprueba la API y activa el cron solo si todo pasa. Cada página detalla su procedimiento.
