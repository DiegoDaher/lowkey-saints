# Módulo 1: Landing Page & Catálogo Interactivo

- **Rama sugerida:** `feat/catalog-landing`
- **Módulo:** `src/modules/catalog`
- **Alcance:** Experiencia de descubrimiento, exploración e impacto visual para clientes provenientes de canales digitales.

---

## Tareas y Requerimientos

### [CAT-01] Maquetación de Hero Section Editorial y Maquetado General

- **Objetivo:** Layout principal en `src/app/(public)/page.tsx` adaptativo (Desktop/Mobile).
- **Entregables:**
  - Hero section con reproducción optimizada de video/fotografía de alta resolución para colecciones activas.
  - Botón de llamada a la acción (CTA) con scroll suave o anclaje directo a la sección `#catalogo`.
  - Contenedor principal bajo Tailwind CSS siguiendo variables visuales de `globals.css`.

### [CAT-02] Desarrollo de Grid Catálogo Modular y Tarjetas de Producto

- **Objetivo:** Cuadrícula de exhibición responsiva con interacción en hover.
- **Entregables:**
  - `src/modules/catalog/ui/components/ProductGrid.tsx`: CSS Grid adaptativo (`grid-cols-2 lg:grid-cols-4`).
  - `src/modules/catalog/ui/components/ProductCard.tsx`: Tarjeta de producto con transición hover para imagen alternativa, precio formateado y disparador para Quick View.
  - Skeleton loaders para estados de carga visual.

### [CAT-03] Modelo de Datos para Tarjetas de Producto

- **Objetivo:** Repositorio y consultas optimizadas de productos con paginación/cursor.
- **Entregables:**
  - Actualización en `prisma/schema.prisma` asegurando índices sobre `status`, `category` y `createdAt`.
  - `src/modules/catalog/infra/PrismaCatalogRepository.ts`: Métodos de consulta paginada (`getPaginatedProducts`) seleccionando únicamente los campos necesarios para la card (evitar payload excesivo).

### [CAT-04] Sistema de Filtros y Búsqueda Dinámica por Categorías (Frontend)

- **Objetivo:** Filtrado dinámico en tiempo real sin recarga completa de página.
- **Entregables:**
  - `src/modules/catalog/ui/components/CategoryFilters.tsx`: Barra de categorías (Tops, Pantalones, Accesorios, Drops).
  - Sincronización con query params en cliente (`nuqs` o `useSearchParams` de Next.js) manteniendo navegación compartible por URL.

### [CAT-05] Modelado de Filtros y Búsqueda Dinámica por Categorías (Backend)

- **Objetivo:** Servicio de aplicación y endpoints para procesamiento de filtros en Prisma.
- **Entregables:**
  - `src/modules/catalog/application/GetCatalogFilteredUseCase.ts`: Lógica de combinación de filtros `where: { category, priceRange, isArchived: false }`.
  - Ruta API en `src/app/api/v1/catalog/route.ts` o Server Actions en `src/modules/catalog/application/actions.ts`.

---

## Estructura del Módulo

```text
src/modules/catalog/
├── application/
│   ├── GetCatalogFilteredUseCase.ts
│   └── GetProductQuickViewUseCase.ts
├── domain/
│   ├── CatalogProduct.ts
│   └── ICatalogRepository.ts
├── infra/
│   └── PrismaCatalogRepository.ts
└── ui/
    ├── components/
    │   ├── HeroEditorial.tsx
    │   ├── ProductGrid.tsx
    │   ├── ProductCard.tsx
    │   ├── QuickViewModal.tsx
    │   └── CategoryFilters.tsx
    └── hooks/
        └── useCatalogFilters.ts
```

## Checklist de Verificación

[ ] El Hero carga recursos multimedia de forma diferida (next/image con priority moderado o next-video).

[ ] Las tarjetas alternan imagen al hacer hover sin salto de layout (CLS = 0).

[ ] Los filtros actualizan la URL sin causar un refresh completo de la página.

[ ] La consulta Prisma utiliza select proyectado y soporta paginación eficiente.
