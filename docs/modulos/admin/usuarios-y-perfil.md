# Usuarios y Mi perfil

> Ticket: **ADM-02** (extensión) · Módulo: [Administración](./README.md)

Alta y gestión de cuentas administrativas sin entrar a Supabase, y autoservicio de contraseña para cada usuario.

## Usuarios (`/140210/usuarios`)

Requiere ADMIN activo (permiso `roles`).

- Lista los perfiles administrativos con su correo, en páginas de 25.
- Crea cuentas ADMIN u OPERATOR con correo y rol. La API genera una contraseña interna aleatoria de 24 caracteres y envía un correo para que el usuario defina la suya.
- Edita permisos y reenvía enlaces de contraseña a cuentas activas. Límite persistente: un envío por cuenta cada 60 segundos.
- Un correo existente devuelve **409**: nunca se sobrescriben credenciales ni permisos al crear.
- El primer ADMIN de un entorno se crea con `scripts/bootstrap-admin.mjs`.

### Fallos parciales

- Si falla guardar el perfil, se elimina la cuenta recién creada. Si también falla esa limpieza, se registra `admin_user_cleanup_required` con el UUID para repararla a mano.
- Si falla el correo después de crear el perfil, la cuenta se conserva y la interfaz permite reenviar. «Solicitud aceptada» no garantiza que el correo llegue al buzón.

## Mi perfil (`/140210/perfil`)

Disponible para ambos roles (permiso `session`).

- Muestra el correo y el rol propios.
- Cambio de contraseña verificando la actual. La nueva debe tener de 12 a 128 caracteres y cumplir las reglas adicionales de Supabase. Al guardar se cierra la sesión.
- No hay cambio obligatorio de contraseña después del primer login.

## Contratos API

Prefijo: `/functions/v1/api/v1`.

| Método y ruta                         | Permiso | Descripción                                          |
| ------------------------------------- | ------- | ---------------------------------------------------- |
| `GET /admin/me`                       | session | Perfil del usuario actual (lo usa `requireAdmin`)    |
| `GET /admin/users`                    | roles   | Listado paginado de perfiles con correo              |
| `POST /admin/users`                   | roles   | Crear cuenta y perfil; envía el enlace de contraseña |
| `POST /admin/users/:id/password-link` | roles   | Reenviar el enlace de contraseña                     |
| `GET` / `PUT /admin/roles`            | roles   | Consultar y cambiar rol o estado (contrato previo)   |

Los enlaces usan la plantilla de recuperación (`supabase/templates/recovery.html`) y el Site URL configurado. Ver [Autenticación y acceso](./autenticacion-y-acceso.md#recuperación-de-contraseña).

## Código

| Pieza                   | Ubicación                                                            |
| ----------------------- | -------------------------------------------------------------------- |
| Pantallas               | `src/components/admin/UsersWorkspace.tsx`, `ProfilePasswordForm.tsx` |
| Lógica de API           | `supabase/functions/_shared/admin-users.ts`                          |
| Política de contraseñas | `supabase/functions/_shared/password-policy.ts`                      |
| Cambio de contraseña    | `changePassword` en `src/server/auth/actions.ts`                     |

## Despliegue

No requiere migraciones. Publicar la Edge Function antes que el frontend y copiar `supabase/templates/recovery.html` a **Reset Password** en cada entorno. Verificar el Site URL y la entrega de correo en staging con cuentas de prueba antes de publicar.

## Pruebas

`tests/admin-users.test.ts`, `tests/admin-users.browser.spec.ts` y los casos de usuarios de `tests/integration.ts`. El navegador usa Auth local simulado y la integración usa PostgreSQL desechable con Auth simulado; la entrega real de correo solo se comprueba en staging.
