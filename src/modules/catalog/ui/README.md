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

### [PDP-04] Carrito Desplegable (Side-Cart) y Retención Temporal

- **Objetivo:** Drawer lateral interactivo sincronizado con el cliente.
- **Entregables:**
  - `src/shared/ui/SideCartDrawer.tsx` montado en el layout raíz o global.
  - Store en cliente con Zustand persistido en `localStorage` (`cart-storage`).
  - Capacidad para agregar, eliminar y mutar cantidades con cálculo en vivo de subtotales.
  - Timestamp de retención temporal en cliente para avisar al usuario cuánto tiempo se reservará su selección tentativa.

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

[ ] Cambiar de variante actualiza instantáneamente el stock visible y el estado del botón de compra.

[ ] El carrito lateral abre automáticamente al añadir un producto sin bloquear el scroll del fondo de forma abrupta.

[ ] Los items en el carrito persisten si se refresca la pestaña del navegador.

[ ] Los cálculos monetarios se manejan en enteros (centavos) para evitar errores de punto flotante en JS.
