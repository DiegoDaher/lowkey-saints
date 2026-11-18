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
  - Se conserva la prohibición de modificar el propio rol. Las cuentas se crean en Supabase Auth; el primer ADMIN usa `scripts/bootstrap-admin.mjs`. Los demás perfiles se asignan desde el panel de roles.

### Configuración y despliegue de ADM-01/02

1. En Supabase Auth configurar Site URL con el origen exacto del entorno, el proveedor de correo y la política de contraseñas. Deshabilitar registro público. No usar comodines de producción en URLs autorizadas.
2. Copiar `supabase/templates/recovery.html` a la plantilla **Reset Password** del proyecto correspondiente. El enlace usa `{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`; no acepta destinos proporcionados por el cliente. La plantilla se configura por entorno y no se publica automáticamente al desplegar Edge Functions.
3. Confirmar las variables públicas de Supabase para Next.js; las credenciales de base de datos y service-role permanecen exclusivamente en el backend. No hace falta una clave privilegiada en Next.js.
4. En staging, cerrar temporalmente el acceso al backoffice y detener las instancias antiguas de la API durante el cambio del enum. Ejecutar `npm run db:deploy`, `npm run db:generate`, desplegar la API y Next.js de esta misma revisión, y reabrir acceso. No mezclar clientes que esperan STAFF con la base que devuelve OPERATOR. El frontend publicado por separado no debe quedar operativo contra la API antigua.
5. Verificar login de ambos roles, bloqueo de costos para OPERATOR, desactivación de cuenta con sesión abierta y recuperación por correo con una cuenta de prueba. Repetir el procedimiento coordinado en producción después de validar staging. Revisar errores 401/403/5xx sin registrar tokens, contraseñas ni enlaces de recuperación.
6. Ante fallo del despliegue mantener el backoffice cerrado y preferir corregir hacia adelante. Un rollback completo requiere coordinar la reversión del enum (`OPERATOR` a `STAFF`) con API y frontend previos; no revertir solo una capa.

### Verificación local

`npm run lint`, `npm run check-types`, `npm run test:unit`, `npm run db:validate`, `npm run check:edge` y `npm run build` cubren comprobaciones estáticas y compilación. `npm run test:browser` inicia sus propios servidores de Next.js y Auth simulado; no necesita un servidor manual ni envía correos. Incluye las solicitudes SSR reales de Next.js al fixture.

En equipos con carga concurrente, ejecutar la suite secuencialmente con `node node_modules/@playwright/test/cli.js test --config tests/playwright.config.ts --workers=1` para evitar timeouts por competencia de recursos.

`npm run test:integration` requiere PostgreSQL local en `127.0.0.1:55439` o `TEST_DATABASE_URL`. Crea y elimina una base desechable, aplica todas las migraciones y prueba RLS con roles PostgreSQL reales, autorización del handler, cambios de rol/actividad y regresiones de pedidos/stock. No apunta a una base remota.

### Fuera de esta entrega

ADM-05 debajo conserva el roadmap original. ADM-04 se documenta con su implementación actual. Las operaciones actuales siguen en Edge Functions; no se migran a Prisma dentro de Server Actions ni se implementan nuevas pantallas financieras en ADM-01/02.

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

- **Objetivo:** Captura de costos unitarios y cálculo de rentabilidad bruta.
- **Entregables:**
  - Campos en esquema Prisma: `costPrice` (costo interno directo) y `salePrice` (precio retail).
  - Cálculo de margen bruto unitario: `Margen = ((salePrice - costPrice) / salePrice) * 100`.
  - `src/app/(admin)/finanzas/page.tsx`: Vista con indicadores clave (KPIs), porcentaje de margen promedio y alertas visuales de productos con bajo margen o margen negativo.

---

## Estructura del Módulo

```text
src/
├── app/(admin)/
│   ├── layout.tsx                # Sidebar admin y validación de rol
│   ├── inventario/page.tsx       # Matriz de stock
│   ├── productos/page.tsx        # CRUD de catálogo
│   └── finanzas/page.tsx         # Dashboard financiero
├── modules/inventory/
│   ├── application/
│   │   ├── UpdateStockMatrixUseCase.ts
│   │   └── CalculateFinancialMarginsUseCase.ts
│   ├── domain/InventoryVariant.ts
│   └── infra/PrismaInventoryRepository.ts
```

## Checklist de Verificación

[ ] Ningún usuario no autenticado puede acceder a páginas protegidas bajo `/admin`; las rutas de autenticación son públicas.

[ ] La matriz de inventario permite guardar cambios en bloque sin enviar requests redundantes.

[ ] El costo interno (costPrice) jamás se expone en endpoints o serializadores públicos del catálogo.

[ ] Las imágenes eliminadas en el panel se desvinculan o eliminan del bucket de almacenamiento.
