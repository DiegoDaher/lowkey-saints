# Módulo 2: Ficha de Producto & Carrito Lateral (Side-Cart)

- **Rama sugerida:** `feat/pdp-sidecart`
- **Módulo:** `src/modules/catalog` (o extensión `src/modules/orders` para Side-Cart)
- **Alcance:** Experiencia de selección detallada, consulta de especificaciones técnicas y gestión de artículos previa al pedido con retención local.

---

## Tareas y Requerimientos

### [PDP-01] Modelo de Datos de Producto Extendido

- **Objetivo:** Modelar atributos completos de prendas en base de datos.
- **Entregables:**
  - Ajuste en `prisma/schema.prisma` para `Product` y `ProductVariant`:
    - Materiales, guía de tallas, especificaciones de cuidado, descripción editorial, array de imágenes secundarias.
  - Tipado de dominio en `src/modules/catalog/domain/ProductDetails.ts`.

### [PDP-02] Ficha de Producto y Carrusel Multimedia

- **Objetivo:** Vista detallada en `src/app/(public)/producto/[slug]/page.tsx`.
- **Entregables:**
  - Carrusel o galería en cuadrícula de fotos en alta resolución con zoom o visualizador optimizado.
  - Bloques de descripción comercial, tabla de composición/materiales y acordeones colapsables para políticas de envío y cuidados.

### [PDP-03] Selector de Variantes e Indicadores de Disponibilidad

- **Objetivo:** Selector de Talla/Color con validación de inventario en tiempo real.
- **Entregables:**
  - Selector accesible de variantes (pills/swatches interactivos).
  - Alerta visual condicional ("Últimas 2 piezas", "Agotado").
  - Deshabilitación reactiva del CTA "Agregar a la bolsa" cuando el stock de la variante seleccionada es 0.
  - Validación de stock contra `src/modules/inventory/application/CheckStockUseCase.ts`.
- **Estado (implementado):**
  - `src/modules/inventory/application/CheckStockUseCase.ts`: función pura `checkStock` (umbral "Últimas N piezas" = stock ≤ 2; "Agotado" con stock 0, variante archivada o cantidad > stock).
  - `src/modules/catalog/ui/components/VariantSelector.tsx` y `StockAlertBadge.tsx`, integrados en `src/components/shop/ProductDetail.tsx` (ruta real: `src/app/(store)/productos/[slug]`).
  - Sin stock, el CTA se muestra deshabilitado y se mantiene el formulario "Avísame cuando vuelva".
  - Límite por bolsa: `checkStock(variant, qty, inCart)` deshabilita el CTA cuando la bolsa ya tiene todo el stock ("Ya tienes todas las piezas disponibles en tu bolsa").
  - Selector con teclado (flechas/Home/End, tabindex itinerante), variantes archivadas ocultas y opciones agotadas marcadas con tachado/diagonal (no solo color).

### [PDP-04] Carrito Desplegable (Side-Cart) y Retención Temporal

- **Objetivo:** Drawer lateral interactivo sincronizado con el cliente.
- **Entregables:**
  - `src/shared/ui/SideCartDrawer.tsx` montado en el layout raíz o global.
  - Store en cliente con Zustand persistido en `localStorage` (`cart-storage`).
  - Capacidad para agregar, eliminar y mutar cantidades con cálculo en vivo de subtotales.
  - Timestamp de retención temporal en cliente para avisar al usuario cuánto tiempo se reservará su selección tentativa.
- **Estado (implementado):**
  - `src/shared/ui/SideCartDrawer.tsx`: `<dialog>` lateral montado una vez en `src/components/StoreShell.tsx` (layout de la tienda). Se abre al agregar desde la ficha y desde el ícono de bolsa del header (con contador). Escape, clic en el fondo y "Seguir comprando" lo cierran y devuelven el foco al disparador. `scrollbar-gutter: stable` evita el salto de layout al bloquear el scroll; la animación respeta `prefers-reduced-motion`.
  - Store: **sin Zustand por decisión del equipo**. `src/components/shop/CartProvider.tsx` conserva `useSyncExternalStore` (sin dependencias) y persiste `{ items, heldAt }` en `localStorage` con la clave `cart-storage`. El contenido antiguo de `lowkey-cart` se migra una vez y se elimina.
  - Dominio puro en `src/modules/orders/domain/cart.ts`: precios en centavos enteros (`toCents` parsea la cadena decimal sin aritmética flotante), subtotales, límite por línea `min(stock al agregar, 20)` y retención.
  - `src/modules/orders/ui/components/CartItemRow.tsx` (miniatura, stepper −/+, quitar, total de línea) y `HoldNotice.tsx` se reutilizan en el drawer y en `/bolsa`.
  - Retención: 60 minutos informativos que se reinician al agregar. Al vencer se avisa "Tu selección ya no está apartada" sin vaciar la bolsa. La reserva real (24 h) sigue ocurriendo en servidor al crear el pedido; el contrato `POST /orders` no cambia.
  - Pruebas: `tests/cart.test.ts` (unitarias) y casos de drawer/persistencia/retención en `tests/pdp-variants.browser.spec.ts`.

---

## Estructura sugerida

```text
src/
├── modules/catalog/
│   ├── ui/components/
│   │   ├── ProductMediaGallery.tsx
│   │   ├── VariantSelector.tsx
│   │   └── StockAlertBadge.tsx
│   └── application/GetProductBySlugUseCase.ts
└── modules/orders/
    ├── domain/CartItem.ts
    └── ui/
        ├── store/useCartStore.ts
        └── components/
            ├── SideCart.tsx
            └── CartItemRow.tsx
```

## Checklist de Verificación

[x] Cambiar de variante actualiza instantáneamente el stock visible y el estado del botón de compra.

[x] El carrito lateral abre automáticamente al añadir un producto sin bloquear el scroll del fondo de forma abrupta.

[x] Los items en el carrito persisten si se refresca la pestaña del navegador.

[x] Los cálculos monetarios se manejan en enteros (centavos) para evitar errores de punto flotante en JS.
