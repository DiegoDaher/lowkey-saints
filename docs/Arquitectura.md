# Arquitectura y estructura

## Resumen

El proyecto usa Next.js 16 con App Router y TypeScript. La interfaz y las rutas HTTP viven en `src/app`; la lógica de negocio se organiza por módulos en `src/modules`; las capacidades transversales se separan entre `src/core`, `src/server` y `src/shared`.

La regla principal es mantener el conocimiento específico de un dominio dentro de su módulo. Las dependencias de infraestructura, como Prisma, autenticación o correo, no deben filtrarse innecesariamente hacia la interfaz.

## Estructura del repositorio

```text
.
├── docs/                 # documentación técnica
├── prisma/               # esquema, migraciones y configuración de Prisma
├── public/               # recursos estáticos
├── src/
│   ├── app/              # App Router de Next.js: páginas, layouts y API
│   ├── core/             # piezas centrales y contratos compartidos del dominio
│   ├── modules/          # módulos de negocio aislados
│   ├── server/           # integraciones exclusivamente de servidor
│   └── shared/           # utilidades, configuración y UI reutilizable
├── supabase/             # migraciones y seeds de Supabase
├── eslint.config.mjs     # reglas de ESLint
├── .prettierrc           # formato y ordenación de clases Tailwind
├── prisma7.config.ts     # ubicación del schema y migraciones Prisma
└── package.json          # scripts, dependencias y lint-staged
```

## Aplicación web

`src/app` es la frontera de Next.js:

- `layout.tsx` define el layout raíz, metadatos y estilos globales.
- `globals.css` importa Tailwind CSS y define las variables visuales globales.
- `(admin)/` es un route group para las áreas administrativas. Actualmente contiene las áreas `inventario`, `ordenes` y `restock` como estructura preparada.
- `(public)/` está reservado para rutas públicas y actualmente no contiene implementación.
- `api/` reserva las rutas HTTP. Dentro están preparados `v1/` para la API versionada y `cron/expire-holds/` para la expiración de retenciones de stock.

Los nombres entre paréntesis son route groups de Next.js: ayudan a organizar rutas sin formar parte de la URL. Una nueva página debe permanecer en `src/app` y delegar la lógica de negocio al módulo correspondiente.

## Módulos de negocio

Cada módulo de `src/modules` sigue la misma división:

```text
src/modules/<modulo>/
├── application/  # casos de uso y coordinación de operaciones
├── domain/       # entidades, reglas e invariantes del negocio
├── infra/        # repositorios y adaptadores externos del módulo
└── ui/           # componentes y presentación específica del módulo
```

Módulos previstos:

- `catalog`: productos, variantes y consulta del catálogo.
- `inventory`: existencias y disponibilidad de variantes.
- `orders`: creación y ciclo de vida de pedidos.
- `restock`: alertas y procesos de reposición.

Las carpetas muestran la arquitectura objetivo; antes de asumir que una operación está disponible hay que verificar que exista código dentro de la capa correspondiente.

## Capas transversales

- `src/core/application`: contratos o servicios de aplicación compartidos entre módulos.
- `src/core/domain`: conceptos y reglas centrales que no pertenecen a un único módulo.
- `src/core/infra`: implementaciones técnicas comunes.
- `src/server/auth`: integración de autenticación del lado servidor.
- `src/server/db`: cliente Prisma compartido. `src/server/db/prisma.ts` evita crear múltiples clientes en desarrollo.
- `src/server/mail`: integración de correo, incluyendo Resend y plantillas React Email cuando se implementen.
- `src/shared/config`: configuración no específica de un dominio.
- `src/shared/hooks`: hooks reutilizables de React.
- `src/shared/lib`: funciones utilitarias compartidas.
- `src/shared/ui`: componentes visuales reutilizables.

Las carpetas vacías son puntos de extensión, no módulos funcionales por sí mismos.

## Persistencia

El schema de PostgreSQL está en `prisma/schema.prisma`. El modelo actual contempla:

- `Product` y `ProductVariant` para productos, tallas, colores y SKU.
- `Order` y `OrderItem` para pedidos y sus líneas.
- `RestockAlert` para avisos de reposición.
- `Role` y `OrderStatus` como enums de dominio/persistencia.

`prisma7.config.ts` apunta a `prisma/schema.prisma`, usa `prisma/migrations` para migraciones y obtiene `DATABASE_URL` del entorno. El schema también declara `DIRECT_URL`; ambas variables deben configurarse fuera del control de versiones.

Comandos relacionados:

```bash
npm run db:generate
npm run db:push
npm run db:studio
```

Para cambios de modelo, actualiza primero el schema, revisa el impacto en los módulos y ejecuta la estrategia de migración acordada antes de desplegar.

## Alias de imports

Los alias definidos en `tsconfig.json` evitan rutas relativas largas:

- `@/*` -> `src/*`
- `@modules/*` -> `src/modules/*`
- `@shared/*` -> `src/shared/*`
- `@server/*` -> `src/server/*`
- `@core/*` -> `src/core/*`

Usa el alias que corresponda a la capa. Evita importar infraestructura de servidor desde componentes que puedan ejecutarse en el navegador.

## Configuración visual

Tailwind CSS 4 se integra mediante `postcss.config.mjs` y `@tailwindcss/postcss`. Prettier usa `prettier-plugin-tailwindcss` para ordenar automáticamente las clases de Tailwind. Los cambios de estilos globales se hacen en `src/app/globals.css`; los componentes reutilizables deben vivir en `src/shared/ui` o en el `ui` del módulo que los posee.
