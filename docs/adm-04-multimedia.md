# ADM-04: multimedia de producto

## Arquitectura y contratos

El navegador comprime fotografías y llama a la API de Supabase con el JWT del usuario. El adaptador en `supabase/functions/_shared/storage/` usa el bucket público `product-images`. Prisma 7 sigue exclusivamente en Edge Functions; Next.js no recibe credenciales privilegiadas. Esta ubicación sustituye `src/server/storage/` del roadmap original.

Solo ADMIN tiene el permiso `images`. OPERATOR no puede subir ni descartar archivos. La API valida el usuario y perfil activo en cada petición, MIME, firma binaria y tamaño acotado a 5 MiB; conserva CORS y rate limits.

- `POST /admin/images`: binario JPEG/PNG/WebP; `201 { id, path, url, expiresAt }`. `id` identifica ProductMediaAsset, no ProductImage. Los campos nuevos son aditivos.
- `DELETE /admin/images/:id`: descarta un temporal del usuario actual; `202 { ok: true }`. Es idempotente para descartes anteriores, devuelve 404 para archivos ajenos/inexistentes y 409 para archivos vinculados o todavía subiendo.
- Crear/editar producto conserva `images: [{ path, alt }]`, máximo 12 y sin rutas repetidas. La API rechaza con 409 temporales ajenos, vencidos, inexistentes o en eliminación. La versión optimista del producto sigue siendo obligatoria para editar.
- `ProductImage` conserva `path`, `alt`, `position` y su unicidad producto/posición. La URL pública se deriva al responder; no se almacena el dominio en PostgreSQL.

## Interfaz

Selección múltiple y arrastre, procesamiento secuencial, estado por archivo, reintento individual, texto alternativo, orden y portada. Acepta originales JPEG/PNG/WebP hasta 15 MiB y reduce el lado mayor a 1600 px sin ampliar; solicita WebP a calidad 0.85 y valida el MIME real y límite de 5 MiB resultante. La subida estándar es adecuada para estos tamaños: [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

Un error no detiene los archivos siguientes. Se bloquea guardar hasta resolver o retirar los pendientes/fallidos. Se advierte antes de abandonar cambios y se liberan recursos locales al desmontar. Las fotos vinculadas se retiran únicamente al guardar el producto; cancelar o recibir 409 conserva las referencias originales. Los temporales sin guardar caducan a las 24 horas; el formulario no persiste al cerrar el navegador.

## Ciclo de vida y concurrencia

`ProductMediaAsset` registra ruta única, creador, fechas, estado y reintentos. Una reserva UPLOADING se confirma antes de contactar Storage; una respuesta incierta no pierde el registro. El éxito pasa a TEMPORARY, y el guardado transaccional del producto a ATTACHED. Las rutas históricas compartidas siguen admitidas.

Guardar, descartar y limpiar bloquean las mismas filas en orden estable. Al retirar la última referencia, el guardado programa DELETE_PENDING. El worker comprueba otra vez las referencias y reclama DELETING antes de contactar Storage fuera de la transacción; ningún guardado puede revincular ese estado. Se conserva DELETED como tombstone: las rutas nunca se reutilizan.

`jobs` procesa hasta 25 candidatos por ejecución. Los temporales y reservas abandonadas vencen a las 24 horas; los descartes explícitos y desvinculaciones confirmadas quedan disponibles de inmediato. Reintenta errores desde un minuto con espera exponencial limitada a una hora y recupera bloqueos de más de cinco minutos. Un token por intento evita que un worker antiguo sobrescriba el resultado de otro. Las eliminaciones son idempotentes incluso si el proceso cayó después de borrar el objeto. La operación usa [Storage API remove](https://supabase.com/docs/guides/storage/management/delete-objects), nunca DELETE sobre storage.objects.

La limpieza está desactivada por defecto (`MEDIA_CLEANUP_ENABLED=false`). Sus fallos se aíslan del procesamiento de pedidos y notificaciones. Logs `jobs.completed.media` incluyen examined/deleted/failed; `media.cleanup.failed` indica un fallo del proceso. Revisar los campos attempts, availableAt y lastError para detectar acumulaciones; no se registran credenciales.

## Migración, inventario y operación

1. Probar en staging. Detener temporalmente escrituras del panel e importaciones, y mantener limpieza desactivada durante la transición.
2. Ejecutar `npm run db:deploy` y `npm run db:generate`. La migración registra cada ruta histórica referenciada como ATTACHED, añade la FK y aplica RLS forzada sin acceso de anon/authenticated.
3. Publicar API y frontend de esta revisión y actualizar el importador por lotes. El importador reserva archivos en una conexión independiente para conservarlos si falla la transacción del lote, bloquea las rutas antes de usarlas y rechaza candidatos en eliminación. No mezclar escritores antiguos con el nuevo esquema.
4. Ejecutar `node scripts/inventory-product-media.mjs` para producir el reporte. Recorre todos los objetos y carpetas; informa huérfanos y referencias sin objeto. Revisar el reporte con escrituras pausadas. Un fallo de listado aborta sin registrar candidatos.
5. Ejecutar `node scripts/inventory-product-media.mjs --apply` para incorporar archivos desconocidos. No borra objetos ni altera registros existentes; los huérfanos reciben 24 horas de gracia desde su incorporación. Las referencias rotas requieren reparación manual.
6. Verificar con archivos de prueba subir, guardar, consultar URL pública, quitar y descartar. Publicar jobs y establecer `MEDIA_CLEANUP_ENABLED=true` cuando la validación esté completa; reutiliza el Cron y JOB_SECRET existentes. El script de despliegue envía explícitamente el valor de la variable (false si no está configurada).
7. Reabrir escrituras. Ante incidentes, desactivar únicamente la limpieza y corregir hacia adelante. No revertir solo la API dejando escritores incompatibles; la eliminación física ya realizada no es reversible.

## Verificación

`npm run test:unit` incluye firmas/tamaños y listado paginado. `npm run test:integration` aplica todas las migraciones a PostgreSQL local desechable y cubre conflictos, referencias compartidas, concurrencia, fallos parciales, recuperación de bloqueos y RLS. Storage se simula en estas pruebas; no demuestran una publicación remota.

`node node_modules/@playwright/test/cli.js test --config tests/playwright.config.ts --workers=1` verifica el panel con Auth/API de prueba y compresión real en Chromium. Completar con `npm run db:validate`, `npm run check:edge`, `npm run check-types`, `npm run lint` y `npm run build`. Las verificaciones con Storage real se realizan en staging antes de activar producción.
