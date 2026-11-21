# Módulo 3: Backoffice Admin, Inventario & Finanzas

- **Rama de implementación:** `feat/admin-inventory-finance-auth` (la rama sugerida ya existía).
- **Módulo:** `src/modules/inventory` & `src/app/(admin)`
- **Alcance:** Entorno privado de administración para gestión operativa, control financiero y catálogo masivo.

---

## Tareas y Requerimientos

### [ADM-01] Autenticación Administrativa

- **Objetivo:** Panel de acceso seguro y protección perimetral de rutas administrativas.
- **Entregables:**
  - Login administrativo en `src/app/(admin)/admin/login/page.tsx` integrando Supabase Auth mediante Server Actions.
  - `src/server/auth/supabase.ts`: Validación de sesión en servidor con `@supabase/ssr`.
  - Protección en `src/proxy.ts` sobre `/admin/:path*`; `(admin)` es un grupo de carpetas, no una URL. Next.js 16 usa proxy, no middleware.
  - Layout y páginas protegidas en `admin/(protected)`, con validación SSR de usuario y perfil activo antes de renderizar. El login, recuperación, confirmación y pantalla sin acceso quedan fuera del layout protegido.
  - Recuperación por correo en `/admin/recuperar`, verificación del enlace en `/admin/auth/confirm` y nueva contraseña en `/admin/restablecer`. No hay registro público ni MFA en esta etapa.

### [ADM-02] Control de Acceso por Roles (RBAC) y RLS

- **Objetivo:** Restricción de acciones basada en roles (`ADMIN`, `OPERATOR`).
- **Entregables:**
  - RLS permanece habilitado y forzado: `anon` y `authenticated` no tienen acceso directo a tablas de negocio, incluido `ProductCost`. `lowkey_api` conserva acceso backend; la autorización del usuario final se aplica en Edge Functions.
  - Migraciones exclusivamente en `prisma/migrations`. La migración `202611170001_operator_role` renombra STAFF a OPERATOR sin perder perfiles. `OrderFinancials` no existe y se difiere a la definición financiera.
  - `AdminProfile` es la fuente vigente de permisos. No se confía en `user_metadata` ni en el rol técnico del JWT. Cada petición de la API valida usuario, perfil activo y permiso explícito por método/ruta; operaciones no registradas se deniegan.
  - ADMIN gestiona catálogo, variantes, imágenes, stock, pedidos, restock, costos, roles y diagnóstico. OPERATOR solo consulta catálogo sin costos, modifica stock existente y opera pedidos (confirmar pago, enviar y cancelar según las transiciones actuales).
  - Se conserva la prohibición de modificar los propios permisos. El primer ADMIN usa `scripts/bootstrap-admin.mjs`; los demás usuarios se crean desde `/140210/usuarios`, con correo y rol, sin abrir Supabase. La API genera una contraseña interna aleatoria de 24 caracteres y solicita un correo para establecer la contraseña personal.

### Usuarios y Mi perfil

- `/140210/usuarios` requiere ADMIN activo: lista perfiles administrativos con correo en páginas de 25, permite crear ADMIN/OPERATOR, editar permisos y reenviar enlaces de contraseña a cuentas activas. Un correo existente devuelve conflicto; nunca se sobrescriben sus credenciales ni permisos al crear.
- `/140210/perfil` permite a ambos roles consultar su correo/rol y cambiar su propia contraseña, verificando la actual. La nueva contraseña debe tener 12–128 caracteres y cumplir las restricciones adicionales de Supabase. Tras guardar se cierra sesión. No hay cambio obligatorio después del login.
- API: `GET/POST /v1/admin/users`, `POST /v1/admin/users/:id/password-link`; `PUT /v1/admin/roles` conserva su contrato. Los enlaces usan la plantilla de recuperación existente y su SiteURL fijo, con un límite persistente de un envío por cuenta cada 60 segundos.
- Si falla guardar el perfil, se elimina la cuenta recién creada; si también falla esa limpieza, se registra `admin_user_cleanup_required` con el UUID para reparación manual. Si falla el correo después de crear el perfil, la cuenta permanece y la interfaz permite reenviar. “Solicitud aceptada” no garantiza entrega al buzón.
- No requiere migraciones nuevas. Desplegar la Edge Function antes del frontend y copiar `supabase/templates/recovery.html` a **Reset Password** por entorno. Verificar SiteURL y correo en staging con cuentas de prueba antes de publicar. El repositorio no actualiza automáticamente esa plantilla en Supabase.
- Verificación: `tests/admin-users.test.ts`, `tests/admin-users.browser.spec.ts` y casos de usuarios en `tests/integration.ts`. Navegador usa Auth local simulado; integración usa PostgreSQL desechable y Auth simulado. La entrega real de correo requiere la comprobación de staging.

### Configuración y despliegue de ADM-01/02

1. En Supabase Auth configurar Site URL con el origen exacto del entorno, el proveedor de correo y la política de contraseñas. Deshabilitar registro público. No usar comodines de producción en URLs autorizadas.
2. Para recuperar desde `/140210/recuperar` con el correo predeterminado de Supabase, configurar `SITE_URL` también en Next.js con el origen exacto de la app (por ejemplo `http://localhost:3000`) y añadir `http://localhost:3000/140210/auth/confirm` a **Authentication → URL Configuration → Redirect URLs**, sustituyendo el origen según el entorno. Configurar también **Site URL** en Supabase. Solicitar un correo nuevo y abrirlo en el mismo navegador y perfil donde se pidió: el código PKCE se valida con una cookie de esa solicitud. No se necesitan cambios de plantilla para este flujo; el servidor de correo integrado mantiene las restricciones de destinatarios del equipo y límites de Supabase. Para producción y los enlaces enviados desde Usuarios, configurar SMTP y copiar `supabase/templates/recovery.html` a **Reset Password**. Esta plantilla usa `{{ .SiteURL }}/140210/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`, sigue siendo compatible y no se publica automáticamente al desplegar Edge Functions. Ningún flujo acepta destinos enviados en el formulario o en `next`.
3. Confirmar las variables públicas de Supabase para Next.js; las credenciales de base de datos y service-role permanecen exclusivamente en el backend. No hace falta una clave privilegiada en Next.js.
4. En staging, cerrar temporalmente el acceso al backoffice y detener las instancias antiguas de la API durante el cambio del enum. Ejecutar `npm run db:deploy`, `npm run db:generate`, desplegar la API y Next.js de esta misma revisión, y reabrir acceso. No mezclar clientes que esperan STAFF con la base que devuelve OPERATOR. El frontend publicado por separado no debe quedar operativo contra la API antigua.
5. Verificar login de ambos roles, bloqueo de costos para OPERATOR, desactivación de cuenta con sesión abierta y recuperación por correo con una cuenta de prueba. Repetir el procedimiento coordinado en producción después de validar staging. Revisar errores 401/403/5xx sin registrar tokens, contraseñas ni enlaces de recuperación.
6. Ante fallo del despliegue mantener el backoffice cerrado y preferir corregir hacia adelante. Un rollback completo requiere coordinar la reversión del enum (`OPERATOR` a `STAFF`) con API y frontend previos; no revertir solo una capa.

### Verificación local

`npm run lint`, `npm run check-types`, `npm run test:unit`, `npm run db:validate`, `npm run check:edge` y `npm run build` cubren comprobaciones estáticas y compilación. `npm run test:browser` inicia sus propios servidores de Next.js y Auth simulado; no necesita un servidor manual ni envía correos. Incluye las solicitudes SSR reales de Next.js al fixture.

En equipos con carga concurrente, ejecutar la suite secuencialmente con `node node_modules/@playwright/test/cli.js test --config tests/playwright.config.ts --workers=1` para evitar timeouts por competencia de recursos.

`npm run test:integration` requiere PostgreSQL local en `127.0.0.1:55439` o `TEST_DATABASE_URL`. Crea y elimina una base desechable, aplica todas las migraciones y prueba RLS con roles PostgreSQL reales, autorización del handler, cambios de rol/actividad y regresiones de pedidos/stock. No apunta a una base remota.

### Fuera de esta entrega

ADM-05 se documenta debajo con su implementación actual. ADM-04 se documenta con su implementación actual. Las operaciones actuales siguen en Edge Functions; no se migran a Prisma dentro de Server Actions ni se implementan nuevas pantallas financieras en ADM-01/02.

### [ADM-03] Catálogo y matriz de inventario

- Rutas `/admin/productos` y `/admin/inventario` dentro de `admin/(protected)`. El panel principal enlaza a ambas.
- ADMIN crea, edita, archiva y restaura productos y variantes. OPERATOR consulta inventario y actualiza existencias; no administra catálogo ni variantes.
- Catálogo con búsqueda, categorías, filtro de activos/archivados/todos y paginación. Se reutiliza el editor de imágenes, medidas y complementos. Las variantes nuevas tienen stock cero.
- Inventario muestra una matriz por prenda: tallas en filas y colores en columnas. Celdas inexistentes muestran `—`; archivadas son de solo lectura. Un borrador registra solo celdas modificadas de la página actual, hasta 100 por lote.
- Antes de cambiar filtros, página o enlaces se ofrece guardar, descartar o cancelar. Al recargar/cerrar se usa la advertencia nativa del navegador. Los borradores viven solo en memoria.
- `src/modules/inventory/application/actions.ts` autentica, autoriza y valida las mutaciones antes de llamar a Edge Functions con el token del usuario. Prisma y las credenciales privilegiadas siguen exclusivamente en el backend.
- `PATCH /admin/stock` conserva `{ changes: [{ id, version, stock }] }`. Transacción serializable, versiones optimistas, enteros 0–100000 y rollback completo ante conflicto. Se rechazan productos/variantes archivados. Reposición desde cero mantiene el outbox transaccional existente.
- `PATCH /admin/products/:id` recibe `{ version, isArchived }`. `PATCH /admin/variants/:id` admite talla, color, hexadecimal, SKU y estado con versión obligatoria; no permite cambiar stock ni producto propietario. `GET /admin/products` acepta `state=active|archived|all` (por compatibilidad, omitirlo equivale a `all`).
- Archivar conserva unidades, referencias y snapshots de pedidos. Restaurar un producto no restaura sus variantes archivadas individualmente. No se añade migración de esquema.
- Validación: `tests/inventory.test.ts`, `tests/inventory.browser.spec.ts` y escenarios ADM-03 de `tests/integration.ts`, además de las regresiones de autenticación/pedidos.
- Despliegue: publicar primero Edge Functions con los contratos compatibles, después Next.js. Verificar ambos roles en staging antes de producción. No requiere nuevas credenciales en Next.js.

### [ADM-04] Carga múltiple de archivos

- Supabase Storage en `supabase/functions/_shared/storage/`, manteniendo Prisma y credenciales privilegiadas en Edge Functions.
- Selección múltiple y drag and drop, compresión en cliente, estados por archivo y reintentos. Hasta 12 fotos; primera como portada.
- `ProductImage` conserva ruta, texto alternativo y orden; la API deriva la URL pública. `ProductMediaAsset` registra temporales y coordina su limpieza con el guardado.
- Solo ADMIN gestiona archivos. Los temporales caducan en 24 horas; quitar una foto vinculada requiere guardar el producto.
- Limpieza asíncrona de archivos sin referencias e inventario de huérfanos históricos. Desactivada por defecto hasta verificar staging.
- [Contratos, migración, operación y pruebas de ADM-04](../../../docs/adm-04-multimedia.md).

### [ADM-05] Financial Accounting y Análisis de Márgenes

Implementado en `/140210/finanzas`, con captura conjunta de precio de venta y costo interno directo por producto, KPIs globales sobre los filtros y umbral configurable inicialmente en 30%. Exclusivo de ADMIN.

Se conservan `Product.salePrice` y `ProductCost.costPrice`. `FinancialSettings` incorpora el umbral global con RLS. Cálculos y transacciones permanecen en Edge Functions; Next.js usa acciones autenticadas.

[Contratos, fórmulas, migración, operación y pruebas de ADM-05](../../../docs/adm-05-finanzas.md).

## Estructura actual del módulo

```text
src/app/(admin)/admin/
  (protected)/layout.tsx
  (protected)/productos/page.tsx
  (protected)/inventario/page.tsx
  (protected)/finanzas/page.tsx
  login/page.tsx
src/modules/inventory/
  application/actions.ts
  domain/stock-draft.ts
supabase/functions/_shared/
  inventory/application/CalculateFinancialMarginsUseCase.ts
  financial-contracts.ts
  service.ts
```

El prefijo visible actual es `/140210`; `/admin` es interno y su acceso directo devuelve 404. Las rutas públicas de autenticación permanecen fuera del layout protegido.

## Verificación del módulo

- Autenticación y autorización: pruebas de acceso y navegador; Finanzas requiere ADMIN.
- Inventario: pruebas de guardado en bloque y conflictos de ADM-03.
- Costos: contratos separados y pruebas de exclusión de respuestas operativas/públicas.
- Imágenes: desvinculación y limpieza asíncrona conforme a ADM-04; su worker conserva la configuración existente.

## Dashboard y componentes de interacción

- El layout raíz conserva fuentes y estilos globales. `(store)` monta los proveedores de carrito/catálogo y la presentación comercial; `(admin)` monta únicamente el entorno administrativo. Las URLs públicas no cambian.
- El layout protegido valida la sesión y entrega el rol a la navegación; `getAdminProfile` deduplica lecturas mediante React `cache` dentro del render, sin persistir permisos entre solicitudes. Las páginas y la API conservan sus verificaciones.
- El inicio muestra accesos operativos sin consultar listados. Reposición tiene su propia ruta `/140210/restock`, exclusiva de ADMIN. Los enlaces del panel no precargan rutas automáticamente.
- `AdminButton`, `AdminLink`, `AdminHeading` y `AdminLoading` comparten presentación e indicadores accesibles. Los formularios conservan sus contratos, validación y protección de borradores.
- Catálogo y Finanzas cargan categorías por montaje, con reintento independiente. Las actualizaciones conservan contenido visible; Pedidos evita consultas de fondo simultáneas y agrupa eventos de foco/visibilidad próximos, manteniendo el intervalo de 30 segundos en pestañas visibles.
- El foco global de campos se dibuja sobre su propio borde. Botones, enlaces, casillas y otros controles conservan un indicador de teclado visible. Las animaciones respetan movimiento reducido.
- `tests/admin-dashboard.browser.spec.ts` comprueba escritorio/móvil, ausencia de consultas operativas en Inicio, carga y actualización de inventario, foco del campo y reintento de reposición. Las pruebas de navegación usan el prefijo público `/140210`; `/admin` sigue devolviendo 404.
- No requiere migraciones, cambios de API ni nuevas variables de entorno. Se publica con el despliegue habitual de Next.js.

### Editores en modal y pantallas de acceso

- Login, recuperación y restablecimiento están agrupados en `(access)` y reutilizan `StoreShell`, con cabecera, navegación, pie y proveedores comerciales. El layout protegido sigue independiente; no cambian URLs ni reglas de acceso.
- Nueva prenda y edición usan un modal con Datos esenciales, Fotografías, Detalles y medidas y Completa el look. El borrador se conserva entre pestañas; guardar mantiene el editor abierto y «Guardar y cerrar» vuelve al catálogo. La Server Action `saveProduct` devuelve el producto guardado en `data` para actualizar ID y versión sin duplicados.
- El detalle se carga una vez por apertura; si falla, el guardado queda bloqueado hasta reintentar. Los complementos usan portada y nombre, límite de tres, búsqueda diferida y paginación. Los candidatos se consultan al abrir su pestaña, no al abrir el editor.
- Variantes tiene su propio modal, con protección de cambios al cerrar o cambiar de variante. Después de una mutación se recarga el detalle; un fallo de esa lectura bloquea nuevas mutaciones hasta reintentar. El catálogo se refresca al cerrar únicamente si hubo guardados.
- `AdminModal` usa un diálogo nativo con fondo inerte, scroll bloqueado, retorno de foco, Escape y confirmación de descarte dentro del mismo modal. La carga diferida tiene un fallback local para no suspender y recargar el catálogo completo.
- Las subidas continúan al cambiar de pestaña. Guardar y cerrar están bloqueados durante subidas; los archivos con errores se pueden reintentar o quitar. Tras guardar, el editor multimedia se reinicia con las imágenes vinculadas para que una eliminación posterior no las trate como temporales.
- Las pantallas y cargas iniciales conservan las estrellas de `Loader`; `Spinner` se comparte para botones y actualizaciones pequeñas. Ambos respetan movimiento reducido.
- Regresión específica: `tests/admin-modals.browser.spec.ts`, `tests/media.browser.spec.ts`, `tests/inventory.browser.spec.ts` y `tests/loader.browser.spec.ts`. No requiere migraciones ni nuevas dependencias.
