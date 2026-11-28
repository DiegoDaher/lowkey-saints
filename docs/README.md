# Documentación del proyecto

Lowkey Saints es una tienda construida con Next.js 16, React 19, Tailwind CSS, Prisma 7 y Supabase (Auth, Storage, Edge Functions y PostgreSQL). Esta carpeta reúne la documentación técnica del repositorio.

```text
docs/
├── README.md              # este índice
├── general/               # temas transversales a toda la aplicación
├── modulos/               # una carpeta por módulo de negocio
├── seguridad-apis.md      # informe de la práctica (lo leen scripts/; no mover)
└── prod-ca-2021.crt       # CA de PostgreSQL (la usan prisma.config.ts y las pruebas; no mover)
```

## General

- [Arquitectura](./general/arquitectura.md): capas, flujo navegador → Next.js → Edge Functions → PostgreSQL, TLS y despliegue.
- [Base de datos](./general/base-de-datos.md): modelo, migraciones y matriz de requisitos BD-01…BD-27.
- [Dependencias y configuración](./general/dependencias.md): paquetes instalados, configuración de Prisma.
- [Calidad y flujo de commits](./general/calidad-y-commits.md): Husky, lint-staged, ESLint, Prettier y TypeScript.
- [Control de versiones](./general/control-de-versiones.md): ramas, integración y Pull Requests.
- [Seguridad de APIs](./seguridad-apis.md): informe de seguridad y despliegue.

## Módulos

Mapa completo y estado de la migración en [modulos/README.md](./modulos/README.md).

| Módulo                   | Documentación                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Administración (ADM)     | [modulos/admin](./modulos/admin/README.md)                                                          |
| Landing y catálogo (CAT) | Pendiente de migrar: [catalogo-landing.md](./catalogo-landing.md) y `src/modules/catalog/README.md` |
| Ficha de producto (PDP)  | [modulos/ficha-producto](./modulos/ficha-producto/README.md)                                        |
| Pedidos y restock (LOG)  | [modulos/pedidos](./modulos/pedidos/README.md)                                                      |

## Arranque rápido

Requisitos: Node.js compatible con Next.js 16 y npm (con el `package-lock.json` versionado). Copiar `.env.example` a `.env`; las variables por entorno están en el [README raíz](../README.md#configurar-y-ejecutar).

```bash
npm ci        # instala dependencias y prepara Husky
npm run dev   # http://localhost:3000
```

## Comandos habituales

```bash
npm run dev               # servidor de desarrollo
npm run build             # compilación de producción
npm run lint              # ESLint
npm run format            # Prettier sobre el repositorio
npm run check-types       # TypeScript sin emitir archivos
npm run check:edge        # deno check de las Edge Functions
npm run db:generate       # genera Prisma Client
npm run db:validate       # valida el esquema
npm run db:deploy         # aplica migraciones (revisar destino antes)
npm run test:unit         # pruebas unitarias
npm run test:integration  # PostgreSQL local desechable
npm run test:browser      # Playwright
```

Los commits ejecutan automáticamente las comprobaciones descritas en [Calidad y flujo de commits](./general/calidad-y-commits.md).

## Cómo mantener esta documentación

- Al cambiar una funcionalidad, actualiza su página dentro de `docs/modulos/<modulo>/` y la tabla de trazabilidad del README del módulo.
- Un ticket nuevo se añade a la página de la funcionalidad que modifica; solo se crea una página nueva si introduce una funcionalidad distinta.
- Los temas que afectan a varios módulos van en `docs/general/`.
