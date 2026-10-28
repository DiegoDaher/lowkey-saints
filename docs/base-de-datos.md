# Base de datos y backend de Lowkey Saints

## Arquitectura implementada

Next.js consume la API de Supabase Edge Functions. Las funciones usan Prisma 7 con adaptador PostgreSQL y runtime Deno. Supabase aloja PostgreSQL, Auth, Storage y Cron. Next.js sigue ejecutándose localmente.

El esquema está en prisma/schema.prisma; el único historial SQL está en prisma/migrations. prisma.config.ts usa DIRECT_URL (pooler en modo sesión, puerto 5432); APP_DATABASE_URL es la conexión exclusiva del backend. La aplicación web no importa Prisma.

## Reglas de negocio

- Moneda MXN, importes Decimal(10,2); la API serializa decimales como cadenas.
- Cada producto admite varias categorías, hasta 12 fotografías y hasta 3 complementos distintos, sin autorreferencias.
- Stock significa unidades disponibles para reservar. La bolsa local no reserva.
- Crear una orden descuenta disponibilidad y guarda sus líneas históricas dentro de una transacción serializable. La reserva dura 24 horas.
- Una clave de idempotencia solo puede reutilizarse con los mismos datos. Los importes enviados por el navegador se rechazan.
- Pendiente puede confirmarse o cancelarse; confirmado puede enviarse. Un pendiente vencido no puede pagarse. Cancelación y expiración restituyen stock una sola vez.
- Ajustar inventario requiere la versión que se leyó; una edición desactualizada devuelve 409.
- SKU único, producto/talla/color único; archivo lógico de productos y variantes conserva pedidos históricos.
- ADMIN administra costos y roles. STAFF administra catálogo, precios de venta, inventario, pedidos y reposición. Nadie puede modificar su propio rol desde el panel.
- Costos se almacenan en ProductCost. El catálogo nunca los selecciona. Utilidad = venta menos costo; porcentaje no aplicable cuando venta es cero.

## Seguridad

Las tablas tienen RLS forzada, sin permisos para anon/authenticated. La API verifica el token con Supabase Auth y consulta el perfil activo en cada operación administrativa. El usuario SQL lowkey_api no posee tablas ni BYPASSRLS; su política permite operaciones del backend, cuya autorización por rol se implementa en las funciones. RLS no interpreta automáticamente la identidad de Prisma.

Las funciones api/jobs desactivan la verificación JWT del gateway porque la primera también sirve operaciones públicas y la segunda usa un secreto independiente. API valida explícitamente cada ruta administrativa; jobs exige JOB_SECRET. Las claves secretas y conexiones nunca son variables NEXT_PUBLIC.

Los endpoints de escritura aplican presupuestos persistentes por minuto (global y por IP/usuario, más teléfono/correo para pedidos y suscripciones). CORS restringe los orígenes; no sustituye autenticación. Las subidas validan firma, tipo y tamaño y solo se aceptan para administradores. Storage permite lectura pública de imágenes; la escritura ocurre mediante el backend.

## API

Base: /functions/v1/api/v1. Respuestas de error: {error, issues?}. Códigos: 400 validación, 401 sesión ausente/inválida, 403 permiso, 404 inexistente, 409 conflicto, 429 límite, 503 configuración pendiente.

| Método y ruta               | Uso                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| GET /categories             | Categorías                                                                                       |
| GET /products               | Catálogo; page, category, q, min, max, size, color, sort; 24 por página                          |
| GET /products/:slug         | Ficha, medidas y complementos                                                                    |
| POST /orders                | Nombre, teléfono, idempotencyKey e items {variantId,quantity}; devuelve recibo y enlace WhatsApp |
| POST /restock               | email, variantId, reactivate opcional                                                            |
| POST /unsubscribe           | token de baja                                                                                    |
| GET /admin/me               | Perfil verificado                                                                                |
| GET /admin/health           | Consulta dentro de transacción Prisma                                                            |
| GET/POST /admin/products    | Listar/crear catálogo                                                                            |
| GET/PUT /admin/products/:id | Consultar/editar; requiere version                                                               |
| POST /admin/variants        | Crear SKU con stock inicial cero                                                                 |
| PATCH /admin/variants/:id   | Archivar/reactivar con version                                                                   |
| PATCH /admin/stock          | changes [{id,version,stock}], todas atómicas                                                     |
| GET /admin/orders           | Pedidos paginados                                                                                |
| PATCH /admin/orders/:id     | Cambio de estado                                                                                 |
| GET /admin/restock          | Interesados y estado de notificaciones                                                           |
| GET/PUT /admin/finances     | Costos y márgenes, solo ADMIN                                                                    |
| GET/PUT /admin/roles        | Usuarios existentes en Auth, solo ADMIN                                                          |
| POST /admin/images          | Binario JPEG/PNG/WebP, máximo 5 MB                                                               |

Los contratos y validadores compartidos están en supabase/functions/_shared/contracts.ts. Los paneles están en /admin; el grupo (admin) heredado no representa una ruta URL.

## Notificaciones y tareas

El reabastecimiento de cero a positivo crea una notificación única por suscripción/generación. La cola persiste reintentos, bloqueo temporal y resultado. Resend recibe el ID de notificación como clave de idempotencia. Entregas inciertas fuera de su ventana de deduplicación se marcan FAILED para revisión; no se garantiza entrega exactamente una vez entre dos sistemas externos.

Supabase Cron llama jobs cada minuto, con URL y secreto en Vault. El worker procesa hasta 100 vencimientos y 25 mensajes por llamada. Un pedido vencido queda bloqueado para confirmación incluso antes del siguiente cron. Inspeccionar cron.job_run_details, net._http_response y logs de Edge Functions ante fallos. Los correos requieren RESEND_API_KEY, RESEND_FROM y SITE_URL HTTPS pública; sin ello la cola se conserva sin enviar.

## Configuración y operación

Consultar .env.example; no versionar .env. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY es preferida; ANON_KEY se admite como compatibilidad. El token personal SUPABASE_ACCESS_TOKEN solo sirve para despliegue.

1. npm run db:validate y npm run db:generate.
2. npm run test:unit, npm run test:integration, npm run check:edge, npm run check-types, npm run lint y npm run build.
3. Inspeccionar destino y respaldo; npm run db:deploy. Nunca usar reset/accept-data-loss sobre la nube.
4. node scripts/provision-runtime.mjs crea la credencial SQL del backend y la guarda en .env sin imprimirla.
5. npm run supabase:deploy publica secretos y funciones, comprueba catálogo y una transacción desde Edge y solo entonces activa Cron.
6. node scripts/smoke-cloud.mjs verifica permisos y compra con usuarios/filas temporales que elimina selectivamente al terminar. No envía correos.
7. npm run dev; npm run test:browser comprueba el navegador con respuestas controladas, sin crear pedidos comerciales.

Para crear el primer ADMIN, guardar ADMIN_EMAIL y ADMIN_PASSWORD en .env y ejecutar `node scripts/setup-admin.mjs`. Supabase aplica su política de contraseñas. El script crea únicamente esa cuenta, sin invitaciones, y rechaza reemplazar otro primer administrador. Para asignar un usuario que ya existe en Auth también está disponible scripts/bootstrap-admin.mjs.

## Evidencia de despliegue: 19 de octubre de 2026

Las tres migraciones están aplicadas en Supabase. Las 14 tablas de negocio tienen RLS activada y forzada. Las funciones api y jobs están publicadas; se verificó una consulta dentro de una transacción Prisma en Edge. El import map usa `@prisma/client/runtime/wasm-compiler-edge`, necesario en el entorno Edge de Supabase; el runtime habitual de Node no es compatible allí.

La prueba remota pasó para acceso anónimo, usuario sin rol, STAFF y ADMIN, catálogo, protección de costos, idempotencia y transiciones de pedidos. Sus cuentas y datos temporales se eliminaron al terminar. Cron está activo cada minuto; sus últimas tres invocaciones devolvieron HTTP 200.

Pasaron validación/generación Prisma, pruebas unitarias y de integración, comprobación Deno, tipos, lint, dos recorridos de navegador y build de Next.js. Las pruebas de correo usan un proveedor simulado: falta configurar Resend y una URL pública para comprobar entrega y enlaces reales. La primera cuenta ADMIN permanente fue creada sin invitaciones; se verificaron su inicio de sesión con contraseña y su autorización ADMIN en la API desplegada.

Las pruebas de integración crean una base PostgreSQL local con nombre aleatorio, aplican todas las migraciones y la eliminan al terminar. Requieren el contenedor de pruebas en 127.0.0.1:55439; TEST_DATABASE_URL permite otro PostgreSQL local. No aceptan bases remotas.

## Matriz de requerimientos

| ID    | Evidencia implementada                               | Verificación                                              |
| ----- | ---------------------------------------------------- | --------------------------------------------------------- |
| BD-01 | PostgreSQL y Prisma 7                                | validate, migraciones e integración                       |
| BD-02 | API catálogo paginado y categorías M:N               | API/navegador                                             |
| BD-03 | ShopService.atomic con transacciones serializables   | Integración concurrente                                   |
| BD-04 | Product: descripción, materiales, especificaciones   | Esquema/editor/ficha                                      |
| BD-05 | Category y ProductCategory                           | Migración/API filtros                                     |
| BD-06 | isArchived y edición versionada                      | API/editor                                                |
| BD-07 | ProductImage ordenado + Storage                      | API de archivos/editor                                    |
| BD-08 | SizeMeasurement y referencias del modelo             | Esquema/editor/ficha                                      |
| BD-09 | ProductComplement, unicidad y CHECK                  | Migración/editor/ficha                                    |
| BD-10 | ProductVariant y matriz de existencias               | Panel/integración                                         |
| BD-11 | SKU único y disponibilidad; pocas unidades 1–3       | Ficha/API                                                 |
| BD-12 | Reserva al crear orden, 24 horas                     | Integración                                               |
| BD-13 | Cancelación transaccional                            | Doble cancelación concurrente                             |
| BD-14 | expiresAt, worker y Cron                             | Expiración y reejecución                                  |
| BD-15 | Descuento condicionado y versiones                   | Última unidad, rollback, edición obsoleta                 |
| BD-16 | salePrice y ProductCost                              | API de finanzas                                           |
| BD-17 | Margen calculado en backend                          | Prueba de precio cero                                     |
| BD-18 | Orden antes del enlace WhatsApp                      | API/navegador                                             |
| BD-19 | OrderItem con cantidad, variante y copias históricas | Integración                                               |
| BD-20 | Estados y transiciones restringidas                  | Dominio/integración/API                                   |
| BD-21 | expiresAt requerido e índice compuesto               | Migración/expiración                                      |
| BD-22 | Correo normalizado                                   | Validación y deduplicación                                |
| BD-23 | RestockSubscription relacionada a variante           | FK y API                                                  |
| BD-24 | Listado administrativo por producto/talla/color      | Panel de reposición                                       |
| BD-25 | Cola persistente y worker Resend                     | Reintentos simulados; entrega real requiere configuración |
| BD-26 | Supabase Auth, login y proxy                         | Prueba de acceso anónimo y smoke cloud                    |
| BD-27 | ADMIN/STAFF, RLS y autorización por operación        | Pruebas SQL y smoke cloud                                 |

Esta matriz distingue implementación de activación: configurar el proveedor de correo sigue siendo necesario para enviar avisos reales. La cuenta ADMIN está activa y verificada. La publicación del frontend está fuera de esta entrega.
