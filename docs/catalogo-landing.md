# Landing y catálogo

## Tokens visuales

Los tokens de la interfaz están definidos en `src/app/globals.css` con `@theme` de Tailwind CSS 4: `ink`, `paper`, `bone`, `line`, `muted`, `gold` y `sale`. El dorado se reserva para acentos y foco; los textos pequeños usan tonos con contraste suficiente sobre los fondos claros.

## Componentes

- `src/components/AnnouncementBar.tsx`, `Header.tsx`, `Footer.tsx` y `sections/Hero.tsx` conforman CAT-01.
- `src/components/catalog/CatalogSection.tsx` y `CatalogToolbar.tsx` presentan CAT-02; `ProductGrid.tsx`, `ProductCard.tsx` y `QuickViewModal.tsx` implementan la cuadrícula y la vista rápida.
- `CatalogFilterProvider.tsx` mantiene filtros compartidos con el menú; `CatalogFilterDialog.tsx` permite filtrar por categoría, rango de precio, talla y color. El selector de orden también reordena los productos localmente.
- El Hero acepta una propiedad `media` de tipo imagen o video. Los SVG locales son recursos editoriales de reemplazo hasta integrar fotografía final y logo de marca.
- `public/lowkey-saints-icon.svg` es un favicon provisional inspirado en el halo y el monograma de la marca. Reemplázalo por el recurso oficial cuando esté disponible.
- `ProductGridSkeleton` y `ProductCardSkeleton` están disponibles para conectar posteriormente con un estado real de carga.

## Sustituir los datos de ejemplo

CAT-02 consume `Product[]` desde `src/types/product.ts`. Por ahora `src/app/page.tsx` entrega `mockProducts`, definido en `src/data/mock-products.ts`, a `CatalogSection`. Para integrar CAT-03, conserva esos componentes y reemplaza únicamente la importación de `mockProducts` por la fuente real, mapeando sus resultados al tipo `Product` y manteniendo las rutas locales/optimizadas de imágenes.

La barra de ordenar y el botón de filtros son solamente presentación: CAT-04 debe aportar su estado y lógica. La paginación y persistencia permanecen fuera de este módulo (CAT-03/CAT-05).
