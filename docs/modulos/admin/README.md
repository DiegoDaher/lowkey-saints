# Administración (Backoffice)

> Módulo 3 · Prefijo de tickets **ADM** · Responsable: Michelle Córdova Torres

Entorno privado para operar la tienda: acceso con roles, catálogo y existencias, fotografías de producto, precios y márgenes, y gestión del equipo. También aloja las pantallas de Órdenes y Reposición, que se documentan en el [módulo de pedidos](../pedidos/README.md).

## Documentación del módulo

| Funcionalidad                                         | Qué cubre                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| [Autenticación y acceso](./autenticacion-y-acceso.md) | Prefijo `/140210`, proxy, login y recuperación, roles y permisos, RLS      |
| [Usuarios y Mi perfil](./usuarios-y-perfil.md)        | Alta de cuentas, roles, enlaces de contraseña, cambio de contraseña propia |
| [Catálogo e inventario](./catalogo-e-inventario.md)   | Editor de productos y variantes, matriz de existencias por lotes           |
| [Multimedia](./multimedia.md)                         | Carga de fotografías, Storage, ciclo de vida y limpieza de archivos        |
| [Finanzas y márgenes](./finanzas.md)                  | Precio y costo, fórmulas de margen, KPIs, umbral de margen bajo            |
| [Interfaz del panel](./interfaz-del-panel.md)         | Layouts, navegación por rol, componentes compartidos, accesibilidad        |

## Rutas

El prefijo público es `/140210`; `/admin` es la ruta interna y su acceso directo devuelve 404.

| Ruta                                                                          | Acceso          | Permiso         |
| ----------------------------------------------------------------------------- | --------------- | --------------- |
| `/140210/login`, `/recuperar`, `/restablecer`, `/auth/confirm`, `/sin-acceso` | Público         | —               |
| `/140210` (Inicio)                                                            | ADMIN, OPERATOR | `session`       |
| `/140210/perfil`                                                              | ADMIN, OPERATOR | `session`       |
| `/140210/inventario`                                                          | ADMIN, OPERATOR | `stock:write`   |
| `/140210/ordenes`                                                             | ADMIN, OPERATOR | `orders`        |
| `/140210/productos`                                                           | ADMIN           | `catalog:write` |
| `/140210/restock`                                                             | ADMIN           | `restock`       |
| `/140210/finanzas`                                                            | ADMIN           | `finances`      |
| `/140210/usuarios`                                                            | ADMIN           | `roles`         |

La matriz completa de permisos de la API está en [Autenticación y acceso](./autenticacion-y-acceso.md#roles-y-permisos).

## Mapa de código

```text
src/proxy.ts                               # prefijo /140210, bloqueo de /admin, sesión
src/server/auth/                           # requireAdmin, getAdminProfile, Server Actions de acceso
src/app/(admin)/
  layout.tsx, admin.css                    # entorno administrativo
  admin/(access)/                          # login, recuperar, restablecer
  admin/(protected)/                       # layout protegido y páginas por sección
  admin/auth/confirm/route.ts              # verificación del enlace de recuperación
  admin/sin-acceso/
src/components/admin/                      # pantallas (…Workspace), editores, componentes Admin*
src/modules/inventory/
  application/actions.ts                   # Server Actions de catálogo, stock y finanzas
  domain/stock-draft.ts                    # validación del lote de existencias
supabase/functions/_shared/
  admin-access.ts                          # roles, permisos y mapa ruta → permiso
  admin-users.ts, password-policy.ts       # usuarios y contraseñas
  service.ts, contracts.ts                 # lógica de negocio y contratos Zod
  financial-contracts.ts
  inventory/application/CalculateFinancialMarginsUseCase.ts
  storage/                                 # adaptador de Supabase Storage
scripts/bootstrap-admin.mjs                # primer ADMIN de un entorno
scripts/inventory-product-media.mjs        # inventario de archivos huérfanos
```

Next.js no se conecta a PostgreSQL: las páginas y Server Actions llaman a la Edge Function `api` con el token del usuario (ver [Arquitectura](../../general/arquitectura.md)).

## Trazabilidad de tickets

| Ticket | Alcance                                           | Documento                                                                                  | Estado                                                                         |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| ADM-01 | Autenticación administrativa                      | [Autenticación y acceso](./autenticacion-y-acceso.md)                                      | Implementado                                                                   |
| ADM-02 | RBAC (ADMIN/OPERATOR), RLS, usuarios              | [Autenticación y acceso](./autenticacion-y-acceso.md) · [Usuarios](./usuarios-y-perfil.md) | Implementado                                                                   |
| ADM-03 | Catálogo y matriz de inventario                   | [Catálogo e inventario](./catalogo-e-inventario.md)                                        | Implementado                                                                   |
| ADM-04 | Carga múltiple de archivos                        | [Multimedia](./multimedia.md)                                                              | Implementado; limpieza desactivada por defecto (`MEDIA_CLEANUP_ENABLED=false`) |
| ADM-05 | Contabilidad financiera y márgenes                | [Finanzas y márgenes](./finanzas.md)                                                       | Implementado                                                                   |
| —      | Dashboard, editores en modal, pantallas de acceso | [Interfaz del panel](./interfaz-del-panel.md)                                              | Implementado                                                                   |

Fuera de alcance por ahora: registro público, MFA, `OrderFinancials` (se difiere hasta definir finanzas por pedido), ventas históricas, impuestos y utilidad neta.

## Verificación del módulo

Estáticas y compilación:

```bash
npm run lint
npm run check-types
npm run test:unit
npm run db:validate
npm run check:edge
npm run build
```

- `npm run test:browser` levanta sus propios servidores de Next.js y Auth simulado; no envía correos. Con carga concurrente, ejecutar en serie: `node node_modules/@playwright/test/cli.js test --config tests/playwright.config.ts --workers=1`.
- `npm run test:integration` necesita PostgreSQL local en `127.0.0.1:55439` o `TEST_DATABASE_URL`. Crea y elimina una base desechable, aplica todas las migraciones y prueba RLS con roles reales. Nunca apunta a una base remota.

Pruebas del módulo: `admin-access`, `admin-users`, `inventory`, `media`, `finances` (`*.test.ts`) y `admin-auth`, `admin-dashboard`, `admin-modals`, `admin-users`, `inventory`, `media`, `finances`, `password-recovery` (`*.browser.spec.ts`), en `tests/`.

## Despliegue

Regla general: **Edge Functions primero, Next.js después**, con contratos compatibles. Las entregas con migraciones (roles, multimedia, finanzas) requieren pausar las escrituras del panel y no mezclar versiones de API y frontend. Cada página de funcionalidad detalla su procedimiento.
