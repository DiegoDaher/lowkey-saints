# Autenticación y control de acceso

> Tickets: **ADM-01** (autenticación) y **ADM-02** (RBAC y RLS) · Módulo: [Administración](./README.md)

Acceso privado al backoffice con Supabase Auth, protección perimetral de rutas y autorización por rol en cada petición a la API. No hay registro público ni MFA en esta etapa.

## Rutas y prefijo público

- El prefijo visible es **`/140210`**. `src/proxy.ts` reescribe `/140210/*` a la ruta interna `/admin/*`, y el acceso directo a `/admin` devuelve **404**. `(admin)` es un grupo de carpetas de Next.js, no forma parte de la URL. Next.js 16 usa proxy, no middleware.
- Rutas públicas (sin sesión): `/140210/login`, `/140210/recuperar`, `/140210/restablecer`, `/140210/auth/confirm` y `/140210/sin-acceso`. Cualquier otra ruta sin sesión se reescribe a `/401`.
- Login, recuperación y restablecimiento están en `src/app/(admin)/admin/(access)/` y comparten `StoreShell` con la tienda. Las páginas protegidas están en `admin/(protected)/`.

## Flujo de una petición protegida

1. **Proxy** (`src/proxy.ts`): refresca las cookies de sesión con `@supabase/ssr` y bloquea a los visitantes sin usuario.
2. **Layout protegido** (`admin/(protected)/layout.tsx`): `requireAdmin()` valida el usuario, consulta `GET /v1/admin/me` y exige un perfil activo.
3. **Página**: cada página llama a `requireAdmin("<permiso>")`. Sin sesión se responde 401 (`unauthorized()`); sin perfil o sin permiso se redirige a `/140210/sin-acceso`.
4. **API** (Edge Function `api`): vuelve a validar el token con Supabase Auth, el perfil activo y el permiso explícito del método y la ruta (`adminPermission` en `supabase/functions/_shared/admin-access.ts`). **Una operación no registrada se deniega.**

`getAdminProfile` (`src/server/auth/supabase.ts`) usa React `cache` para leer el perfil una sola vez por render, sin guardar permisos entre solicitudes.

## Roles y permisos

`AdminProfile` es la fuente de permisos. No se confía en `user_metadata` ni en el rol técnico del JWT.

| Permiso         | ADMIN | OPERATOR | Uso                                            |
| --------------- | :---: | :------: | ---------------------------------------------- |
| `session`       |   ✓   |    ✓     | Entrar al panel, inicio, Mi perfil             |
| `catalog:read`  |   ✓   |    ✓     | Consultar productos (sin costos)               |
| `stock:write`   |   ✓   |    ✓     | Inventario: modificar existencias              |
| `orders`        |   ✓   |    ✓     | Órdenes: confirmar pago, enviar, cancelar      |
| `catalog:write` |   ✓   |          | Crear y editar productos y variantes, archivar |
| `images`        |   ✓   |          | Subir y descartar fotografías                  |
| `restock`       |   ✓   |          | Panel de reposición y reintentos               |
| `finances`      |   ✓   |          | Precios, costos y márgenes                     |
| `roles`         |   ✓   |          | Usuarios y roles                               |
| `health`        |   ✓   |          | Diagnóstico (`GET /v1/admin/health`)           |

Nadie puede modificar sus propios permisos.

## Seguridad en base de datos (RLS)

- RLS está habilitado y forzado. `anon` y `authenticated` no tienen acceso directo a las tablas de negocio, incluida `ProductCost`. Solo el rol de backend `lowkey_api` accede, y la autorización del usuario final se aplica en las Edge Functions.
- Las migraciones viven exclusivamente en `prisma/migrations`. `202611170001_operator_role` renombró `STAFF` a `OPERATOR` sin perder perfiles.

## Recuperación de contraseña

`/140210/recuperar` solicita el correo → el enlace llega a `/140210/auth/confirm` (verificación PKCE o `token_hash`) → `/140210/restablecer` guarda la nueva contraseña. Ningún flujo acepta destinos enviados en el formulario o en `next`.

- El enlace debe abrirse **en el mismo navegador y perfil** donde se pidió: el código PKCE se valida con una cookie de esa solicitud.
- La plantilla `supabase/templates/recovery.html` usa `{{ .SiteURL }}/140210/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. **No se publica automáticamente**: hay que copiarla a _Authentication → Email Templates → Reset Password_ en cada entorno.

## Código

| Pieza                    | Ubicación                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Proxy y prefijo          | `src/proxy.ts`                                                                                         |
| Sesión y `requireAdmin`  | `src/server/auth/supabase.ts`                                                                          |
| Server Actions de acceso | `src/server/auth/actions.ts` (`login`, `logout`, `requestRecovery`, `resetPassword`, `changePassword`) |
| Formularios              | `src/components/admin/AuthForm.tsx`                                                                    |
| Permisos por ruta de API | `supabase/functions/_shared/admin-access.ts`                                                           |
| Primer ADMIN             | `scripts/bootstrap-admin.mjs`                                                                          |

## Configuración y despliegue

1. En Supabase Auth: configurar **Site URL** con el origen exacto del entorno, el proveedor de correo (SMTP en producción) y la política de contraseñas. Deshabilitar el registro público. No usar comodines en las URLs autorizadas de producción.
2. Añadir `<origen>/140210/auth/confirm` a _Authentication → URL Configuration → Redirect URLs_ y definir `SITE_URL` en Next.js con el mismo origen (por ejemplo `http://localhost:3000`).
3. Next.js solo necesita las variables públicas de Supabase. Las credenciales de base de datos y service-role permanecen en el backend.
4. Cambios del enum de roles: cerrar temporalmente el backoffice, detener las instancias antiguas de la API, ejecutar `npm run db:deploy` y `npm run db:generate`, publicar la API y Next.js **de la misma revisión** y reabrir. No mezclar clientes que esperan `STAFF` con una base que devuelve `OPERATOR`.
5. Verificar en staging: login de ambos roles, bloqueo de costos para OPERATOR, desactivación de una cuenta con sesión abierta y recuperación por correo. Revisar errores 401/403/5xx sin registrar tokens, contraseñas ni enlaces.
6. Ante un fallo, mantener el backoffice cerrado y corregir hacia adelante. Un rollback completo exige revertir el enum (`OPERATOR` → `STAFF`) junto con la API y el frontend previos; no revertir solo una capa.

## Pruebas

- `tests/admin-access.test.ts`: matriz de permisos y rutas de API.
- `tests/admin-auth.browser.spec.ts` y `tests/password-recovery.browser.spec.ts`: login, protección de rutas y recuperación con Auth simulado.
- `tests/integration.ts`: RLS con roles reales de PostgreSQL, autorización del handler y cambios de rol o de estado activo.

Ver también: [Usuarios y Mi perfil](./usuarios-y-perfil.md) · [Informe de seguridad de APIs](../../seguridad-apis.md).
