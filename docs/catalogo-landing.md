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

La barra de ordenar y el botón de filtros son solamente presentación: CAT-04 debe aportar su estado y lógica. El filtrado, orden y paginación (24 por página) los resuelve la API (CAT-05, `supabase/functions/_shared/catalog/`); la sincronización con la URL corresponde a CAT-04.

## Footer y páginas de ayuda

- `src/lib/store-contact.ts` es la fuente única de datos públicos: Instagram (`@lowkey_saints`), correo (`hola@lowkey-saints.com`, simulado), puntos de entrega y `getWhatsApp()`. Este último lee `WHATSAPP_PHONE` (la misma variable que usa la API para el enlace del pedido) y solo debe llamarse desde Server Components; si falta o es inválida, la tarjeta de WhatsApp no se muestra.
- `src/components/icons/InstagramIcon.tsx` sustituye al ícono de marca que `lucide-react` 1.x ya no incluye.
- `src/components/sections/InfoPage.tsx` da la estructura común de las páginas de ayuda.
- Rutas: `/envios` (puntos de entrega: Punto Guadiana, Paseo Durango y Portal Durango), `/preguntas-frecuentes` (flujo del cliente: catálogo → bolsa → pedido → WhatsApp, pago, entrega y avisos de reposición) y `/contacto` (WhatsApp, correo e Instagram).
- Para agregar o quitar un punto de entrega, edita `PICKUP_POINTS`; las páginas se actualizan solas.
