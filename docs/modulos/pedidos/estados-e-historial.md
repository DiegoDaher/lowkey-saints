# Estados e historial de pedidos

> Ticket: **LOG-02** · Módulo: [Pedidos y restock](./README.md) · Ruta: `/140210/ordenes` · Acceso: ADMIN y OPERATOR (permiso `orders`)

Máquina de estados del pedido, operación manual desde el Backoffice e historial de cambios de solo inserción.

## Reglas

```text
PENDING_PAYMENT ──confirmar pago (antes de vencer)──▶ CONFIRMED ──enviar──▶ SHIPPED
       │
       └──cancelar (operador o expiración)──▶ CANCELLED
```

- Pendiente permite confirmar el pago **antes del vencimiento** o cancelar. Confirmado solo permite enviar. Enviado y Cancelado son terminales.
- La reserva dura 24 horas y la hora del servidor decide si todavía se puede confirmar. Un pendiente vencido conserva su etiqueta hasta que el worker o un operador lo cancele (ver [Expiración y liberación de stock](./expiracion-y-stock.md)).
- Pedir el estado actual no modifica nada: repetir el mismo estado es idempotente.
- Cancelar devuelve las unidades al stock y, si una variante pasa de 0 a más de 0, encola los avisos de reposición.
- La lógica pura está en `supabase/functions/_shared/orders/domain/OrderStateValidator.ts` (`availableOrderActions`, `requireTransition`); la transacción, en `ShopService.transition` (`supabase/functions/_shared/service.ts`).

## Historial

- La creación y cada cambio efectivo añaden una fila `OrderStatusHistory` **en la misma transacción** que el pedido, el stock y el outbox.
- Cada evento guarda el estado anterior y el nuevo, la fecha, el origen (`CHECKOUT`, `MANUAL` o `EXPIRATION`) y, en cambios manuales, el UUID del operador autenticado. No hay campo de motivo. El UUID se conserva sin FK al perfil.
- El backend puede leer e insertar historial, pero no editarlo ni borrarlo. RLS está forzada y los roles del navegador no tienen acceso directo.
- La migración `202611110001_order_history` es aditiva y no inventa eventos anteriores. Si falta el evento `CHECKOUT`, la vista advierte que el historial puede estar incompleto.

## Contratos API

Prefijo: `/functions/v1/api/v1`. Permiso `orders` (ADMIN y OPERATOR activos).

| Método y ruta                   | Contrato                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/orders`             | `page` (desde 1), `status` opcional. Hasta 50 pedidos, orden descendente por creación e ID. Cada pedido incluye `availableActions`, calculadas en servidor. |
| `PATCH /admin/orders/:id`       | Cuerpo estricto `{ status: CONFIRMED \| SHIPPED \| CANCELLED }`. Devuelve el pedido actualizado y `availableActions`. El actor sale de la sesión.           |
| `GET /admin/orders/:id/history` | Lista cronológica `{ id, fromStatus, toStatus, createdAt, source, actorId }`; 404 si el pedido no existe.                                                   |

Errores: 400 entrada inválida, 401 sesión inválida o ausente, 403 perfil inactivo o sin permiso, 404 inexistente, 409 transición ilegal, reserva vencida o pedido modificado por otra operación.

Fechas en ISO e importes como cadenas decimales.

## Interfaz (`/140210/ordenes`)

- `src/components/admin/OrdersConsole.tsx`: comprador, artículos, total, fechas en `America/Mexico_City`, etiquetas con texto y color, filtro por estado e historial desplegable.
- Cada acción pide confirmación (sin motivo) y las acciones se bloquean mientras se guarda. Ante un 409 recarga y explica el conflicto.
- Refresca cada 30 segundos con la pestaña visible y al recuperar el foco, sin consultas simultáneas.
- La paginación ofrece «Siguiente» cuando llegan 50 filas; la última página puede estar vacía.

## Despliegue

1. `npm run db:generate` y `npm run db:validate`.
2. `node scripts/check-order-data.mjs`: consulta `DIRECT_URL` en una transacción de solo lectura y muestra migraciones, conteos e inconsistencias sin datos personales. Resolver las inconsistencias antes de publicar.
3. Aplicar la migración con `npm run db:deploy`, después publicar `api` y `jobs` **juntos** y al final el frontend. Comprobar que no queden instancias antiguas atendiendo operaciones: durante un despliegue progresivo pueden omitirse eventos de historial.
4. Verificar el acceso de ambos roles, un cambio manual con su historial, la expiración sin duplicados y los logs de `api` y `jobs`.
5. Ante un rollback, conservar la tabla de historial y sus datos.

Fuera de alcance: pagos externos, seguimiento público, paqueterías, reembolsos y notificaciones de estado al comprador.

## Pruebas

- `tests/order-state.test.ts`: transiciones y acciones disponibles.
- `tests/orders.browser.spec.ts`: consola de órdenes con API simulada (Next en el puerto 3102 y Auth simulado en 55440, solo local).
- `tests/integration.ts`: carreras, rollback, historial, RLS y endpoints reales con Auth simulado, sobre PostgreSQL desechable (puerto 55439 por defecto). Nunca apuntar estas pruebas a producción.

Para probar el handler sin levantar un servidor, la API separa `supabase/functions/api/handler.ts` (fábrica con dependencias inyectables) de `index.ts` (arranque de Deno). La inyección de Auth solo se usa desde las pruebas.

Última verificación registrada (2026-11-11): unitarias, integración, navegador, lint, tipos, Deno, Prisma y build aprobados. En el entorno remoto la migración de historial todavía no estaba aplicada en esa fecha.
