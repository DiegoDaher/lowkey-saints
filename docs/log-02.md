# LOG-02 · Estados e historial de pedidos

El backend vive en Supabase Edge Functions. El validador puro está en `supabase/functions/_shared/orders/domain/OrderStateValidator.ts`; la vista dedicada está en `src/app/admin/ordenes/page.tsx`, bajo la protección existente de `/admin/*`. La sección Pedidos de administración enlaza a esta pantalla.

## Reglas

Pendiente permite confirmar pago antes del vencimiento o cancelar. Confirmado solo permite enviar. Enviado y Cancelado son terminales. La reserva conserva sus 24 horas; la hora del servidor decide si se puede confirmar. Solicitar el estado actual no modifica nada. Un pendiente vencido conserva su etiqueta hasta que el cron o un operador lo cancele.

La creación y cada cambio efectivo añaden `OrderStatusHistory` en la misma transacción que el pedido, stock y outbox. El evento contiene estados anterior/nuevo, fecha, origen CHECKOUT/MANUAL/EXPIRATION y UUID del operador autenticado para cambios manuales. No hay campo de motivo. El UUID se conserva sin FK al perfil. El backend puede leer e insertar historial; no editarlo ni borrarlo. RLS está forzada y los roles del navegador no tienen acceso directo.

La migración es aditiva y no inventa eventos anteriores. Si falta el evento CHECKOUT, la vista advierte que el historial puede estar incompleto. Durante un despliegue progresivo también puede haber eventos omitidos por instancias antiguas; publicar API y jobs conjuntamente y comprobar sus versiones antes de aceptar la verificación final.

## Contratos

- `GET /v1/admin/orders?page=1&status=PENDING_PAYMENT`: lista de hasta 50 pedidos, filtro de estado opcional, orden descendente por creación e ID. Añade `availableActions`, calculadas en servidor; conserva fechas ISO e importes como cadenas.
- `PATCH /v1/admin/orders/:id`: cuerpo estricto `{status: CONFIRMED|SHIPPED|CANCELLED}`. Devuelve pedido actualizado y `availableActions`. El actor se obtiene de la sesión, no del cuerpo. Repetir el mismo estado es idempotente.
- `GET /v1/admin/orders/:id/history`: lista cronológica `{id, fromStatus, toStatus, createdAt, source, actorId}`; 404 si no existe el pedido.
- Perfiles activos ADMIN y STAFF pueden operar. Errores: 400 entrada inválida, 401 sesión inválida/ausente, 403 perfil inactivo, 404 inexistente, 409 transición ilegal o reserva vencida.

La interfaz muestra comprador, artículos, total, fechas en America/Mexico_City, etiquetas con texto/color e historial desplegable. Cada acción requiere confirmación sin motivo. Refresca cada 30 segundos con la pestaña visible y al recuperar el foco; ante 409 recarga y explica el conflicto. Las acciones se bloquean mientras se guarda. La paginación ofrece Siguiente cuando se reciben 50 filas; la última página puede estar vacía.

## Pruebas y despliegue

1. `npm run db:generate` y `npm run db:validate`.
2. `npm run test:unit`, `npm run test:integration`, `npm run test:browser`, `npm run lint`, `npm run check-types`, `npm run check:edge`, `npm run build`.
3. Integración crea y elimina una base desechable en PostgreSQL local (puerto 55439 por defecto). Cubre carreras, rollback, historial, RLS y endpoints reales con Auth simulado. Nunca apuntar estos tests a producción.
4. Navegador arranca Next en 3102 y un Auth simulado exclusivamente local en 55440; simula respuestas de negocio. No modifica configuración de Auth ni datos remotos. La autenticación y permisos del backend se comprueban aparte en integración.
5. Ejecutar `node scripts/check-order-data.mjs`: consulta DIRECT_URL con transacción de solo lectura y muestra migraciones, conteos e inconsistencias sin datos personales. Resolver inconsistencias antes de publicar.
6. Aplicar la migración `202611110001_order_history` con `npm run db:deploy`; después publicar API y jobs actualizados, y finalmente frontend. Verificar que no queden instancias antiguas atendiendo operaciones.
7. Comprobar acceso de ambos roles, cambio manual e historial, expiración efectiva sin duplicados y logs de API/jobs. No desplegar frontend antes que API. No revertir eliminando historial; ante rollback conservar la tabla y sus datos.

No incluye pagos externos, tracking público, paqueterías, reembolsos ni nuevas notificaciones.

## Resultado de verificacion (2026-11-11)

Aprobados: 50 pruebas unitarias, integracion PostgreSQL en base desechable (incluidos endpoints y permisos), seis pruebas de navegador, lint, tipos, comprobacion Deno, validacion Prisma y build de produccion. El build incluye `/admin/ordenes`.

Inspeccion remota de solo lectura: las tres migraciones anteriores estan aplicadas; no hay pedidos existentes ni inconsistencias de totales, fechas o stock negativo. La tabla de historial aun no existe en ese entorno. No se aplico la nueva migracion ni se desplegaron funciones o frontend.

Para probar el handler real sin iniciar un servidor, la API separa `handler.ts` (fabrica inyectable) de `index.ts` (arranque incondicional de Deno). La inyeccion de Auth se utiliza exclusivamente desde las pruebas; la entrada de produccion usa Supabase Auth.
