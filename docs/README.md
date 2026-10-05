# Documentación del proyecto

Lowkey Saints es una aplicación web construida con Next.js, TypeScript, Tailwind CSS, Prisma y Supabase. Esta carpeta reúne la documentación técnica que ayuda a entender el repositorio y a trabajar con él sin romper los controles automáticos de calidad.

## Documentos

- [Arquitectura y estructura](./architecture.md): organización de `src`, responsabilidades de cada capa, rutas de Next.js y límites entre módulos.
- [Calidad y flujo de commits](./quality-and-commits.md): Husky, lint-staged, ESLint, Prettier, TypeScript y comprobaciones antes de confirmar cambios.
- [Configuración de dependencias](./config.md): grupos de dependencias instaladas y su propósito.
- [Configuración de Prisma](./config.prisma.md): notas generadas durante la inicialización de Prisma.
- [Landing y catálogo](./catalogo-landing.md): tokens visuales, componentes CAT-01/CAT-02 y reemplazo de datos mock.

## Arranque rápido

Requisitos:

- Node.js compatible con Next.js 16.
- npm, usando el `package-lock.json` versionado.
- `DATABASE_URL` y `DIRECT_URL` cuando se utilice Prisma.
- Las variables de entorno de Supabase, correo u otros servicios que requiera la funcionalidad en desarrollo.

Instalar dependencias y preparar los hooks:

```bash
npm install
```

El script `prepare` ejecuta `husky` durante la instalación. Después se puede iniciar el servidor:

```bash
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

## Comandos habituales

```bash
npm run dev          # servidor de desarrollo
npm run build        # compilación de producción
npm run start        # servidor a partir de la compilación
npm run lint         # ESLint
npm run format       # Prettier sobre el repositorio
npm run check-types  # TypeScript sin emitir archivos
npm run db:generate  # genera Prisma Client
npm run db:push      # sincroniza el esquema con la base de datos
npm run db:studio    # abre Prisma Studio
npm test             # actualmente es un placeholder
```

Los commits normales también ejecutan automáticamente las comprobaciones descritas en [Calidad y flujo de commits](./quality-and-commits.md).

## Estado de la documentación

La arquitectura de capas y los módulos de negocio están preparados en el árbol de `src`, pero algunas carpetas todavía no contienen implementación. Cuando una funcionalidad pase de esqueleto a código ejecutable, debe actualizarse la documentación del módulo y sus rutas.
