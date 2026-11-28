# Expiración de reservas y worker `jobs`

> Ticket: **LOG-03** · Módulo: [Pedidos y restock](./README.md) · Sin interfaz: corre en segundo plano

Cancela los pedidos pendientes cuya reserva de 24 horas venció y devuelve sus unidades al inventario. Corre en la Edge Function `jobs`, que además procesa la cola de avisos de reposición y la limpieza de multimedia.

> **Diferencia con la especificación original:** no existe `src/app/api/cron/expire-holds/route.ts`, `CRON_SECRET` ni `ExpirePendingOrdersUseCase` en `src/modules/orders`. Next.js no se conecta a la base de datos; el worker vive en Supabase y la retención es de 24 horas, no de 30 a 60 minutos.

## Cómo se dispara

```text
pg_cron 'lowkey-jobs' (* * * * *, cada minuto)
  └─ public.lowkey_run_jobs()            # SECURITY DEFINER, lee URL y secreto de Supabase Vault
       └─ net.http_post → Edge Function jobs  (Authorization: Bearer <JOB_SECRET>)
```

- La función SQL `lowkey_run_jobs()` está en la migración `202610150003_jobs`. Lee los secretos `lowkey_jobs_url` y `lowkey_job_secret` de Vault; si faltan, falla con «Lowkey job secrets are not configured».
- `scripts/deploy-supabase.mjs` (`npm run supabase:deploy`) despliega las funciones, comprueba la API y una transacción de prueba, guarda los secretos en Vault y programa el cron. Si alguna comprobación falla, **no activa el cron**.
- `jobs` solo acepta `POST` con `Authorization: Bearer <JOB_SECRET>` (comparación por hash); cualquier otra petición recibe 401.

## Qué hace cada ejecución

`supabase/functions/jobs/index.ts`, en este orden:

1. **Expira pedidos**: `ShopService.expire()` toma hasta 100 pedidos `PENDING_PAYMENT` con `expiresAt <= ahora` (los más antiguos primero) y cancela cada uno con `transition(id, "CANCELLED", expiredOnly = true)`.
2. **Limpia límites de peticiones** vencidos (`RateLimit`).
3. **Envía avisos de reposición** (hasta 25 por ejecución) si `RESEND_API_KEY`, `RESEND_FROM` y un `SITE_URL` con `https://` están configurados. Si no, lo omite y registra `mailConfigured: false`. Ver [Restock y notificaciones](./restock-y-notificaciones.md).
4. **Limpia multimedia** solo si `MEDIA_CLEANUP_ENABLED=true`. Sus fallos se aíslan (`media.cleanup.failed`). Ver [Multimedia](../admin/multimedia.md).
5. Registra `{"event":"jobs.completed", expired, media, sent, mailConfigured}` y responde `{ expired, sent, media }`. Ante un error inesperado registra `jobs.failed` y responde 500.

Una petición con `{ "probe": true }` solo ejecuta una consulta de diagnóstico TLS (`pg_stat_ssl`); la usa el despliegue.

## Garantías de la cancelación

Cada pedido se cancela en su propia transacción serializable:

- Vuelve a comprobar que siga `PENDING_PAYMENT` y vencido; si otro proceso ya lo cambió, responde 409 y el worker lo **omite sin fallar** (sin duplicados si dos ejecuciones se solapan).
- Actualiza el estado de forma condicionada (`updateMany` con el estado anterior).
- Registra el historial con origen `EXPIRATION` y sin actor.
- Devuelve las unidades a `ProductVariant.stock`, en orden estable de variante para evitar bloqueos cruzados, e incrementa su versión.
- Si una variante pasa de 0 a más de 0, encola los avisos de reposición en la misma transacción.

## Configuración

| Variable o secreto                          | Dónde                | Uso                                         |
| ------------------------------------------- | -------------------- | ------------------------------------------- |
| `JOB_SECRET`                                | Edge Function `jobs` | Autenticación del cron                      |
| `lowkey_jobs_url`, `lowkey_job_secret`      | Supabase Vault       | Destino y token que usa `lowkey_run_jobs()` |
| `RESEND_API_KEY`, `RESEND_FROM`, `SITE_URL` | `jobs`               | Envío de avisos (opcional)                  |
| `MEDIA_CLEANUP_ENABLED`                     | `jobs`               | Limpieza de Storage (por defecto `false`)   |

## Operación

- Revisar los logs `jobs.completed` (cuántos pedidos expiraron, avisos enviados) y `jobs.failed`.
- Un pedido vencido sigue mostrándose como pendiente hasta que corre el worker; confirmarlo ya no es posible (409 «El pedido venció»).
- Publicar `api` y `jobs` de la misma revisión.

## Pruebas

- `tests/order-state.test.ts` y `tests/domain.test.ts`: la máquina de estados rechaza pagos tardíos y reaperturas.
- `tests/integration.ts`: expiración efectiva, reejecución sin duplicados y devolución de stock sobre PostgreSQL desechable.
