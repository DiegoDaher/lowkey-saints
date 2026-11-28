# Dependencias y configuración

Versiones exactas en `package.json` y `package-lock.json`; instalar siempre con `npm ci` (o `npm install` si se cambian dependencias).

## Producción

| Grupo                    | Paquetes                                        | Uso                                                                                 |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Framework                | `next` 16.3, `react` / `react-dom` 19.2         | App Router; `src/proxy.ts` sustituye al middleware.                                 |
| Base de datos            | `@prisma/client`, `@prisma/adapter-pg`, `pg`    | Prisma 7 con adaptador `pg`. Solo se usa en Edge Functions y scripts, no en la web. |
| Auth y Storage           | `@supabase/supabase-js`, `@supabase/ssr`        | Sesión en servidor (`src/server/auth/supabase.ts`) y cliente de navegador.          |
| Formularios y validación | `zod`, `react-hook-form`, `@hookform/resolvers` | Contratos compartidos entre la web y la API.                                        |
| Interfaz                 | `lucide-react`, `clsx`, `tailwind-merge`        | Iconos y composición de clases.                                                     |
| Entorno                  | `dotenv`                                        | Carga `.env` en `prisma.config.ts` y scripts.                                       |

El correo (Resend) se envía con un adaptador `fetch` propio en `supabase/functions/_shared/restock/infra/ResendMailer.ts`; no hay SDK de Resend ni React Email instalados.

## Desarrollo

| Grupo               | Paquetes                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Tipos y compilación | `typescript`, `@types/*`, `tsx`                                                                   |
| Estilos             | `tailwindcss` 4, `@tailwindcss/postcss`                                                           |
| Calidad             | `eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss`, `husky`, `lint-staged` |
| Pruebas             | `@playwright/test`                                                                                |
| Backend             | `prisma` (CLI), `supabase` (CLI), `deno` (`npm run check:edge`)                                   |

Ver [Calidad y flujo de commits](./calidad-y-commits.md) para los hooks de Husky y lint-staged.

## Prisma

- Configuración en `prisma.config.ts`: esquema `prisma/schema.prisma`, migraciones `prisma/migrations`, conexión `DIRECT_URL`.
- Si `DIRECT_URL` no es local, se fuerza TLS estricto con la CA `docs/prod-ca-2021.crt` (no mover ese archivo).
- El cliente generado vive en `supabase/functions/_shared/generated/prisma` y lo consumen las Edge Functions.
- Comandos: `npm run db:generate`, `npm run db:validate`, `npm run db:deploy` (migraciones en un entorno), `npm run db:studio`. Más detalle en [Base de datos](./base-de-datos.md).
