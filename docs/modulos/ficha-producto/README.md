# Ficha de producto y side-cart

> Módulo 2 · Prefijo de tickets **PDP** · Responsable: Manuel Alejandro Hernández Rubio

Vista detallada de cada prenda (galería con zoom, textos editoriales, guía de tallas, «Completa el look»), selección de talla y color con disponibilidad en tiempo real, y la bolsa del navegador con su panel lateral.

## Documentación del módulo

| Funcionalidad                                                 | Qué cubre                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Modelo de datos](./modelo-de-datos.md)                       | Modelos de Prisma, tipo `CatalogProduct`, `GET /v1/products/:slug`                |
| [Ficha y galería](./ficha-y-galeria.md)                       | Estructura de la página, visor con zoom, materiales, guía de tallas, complementos |
| [Variantes y disponibilidad](./variantes-y-disponibilidad.md) | `checkStock`, selector accesible, alertas, estados del botón de compra            |
| [Bolsa y side-cart](./bolsa-y-side-cart.md)                   | `CartProvider`, reglas en centavos, retención de 60 min, drawer                   |

## Rutas

| Ruta                    | Acceso  | Documento                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------- |
| `/productos/[slug]`     | Público | [Ficha y galería](./ficha-y-galeria.md)                             |
| Drawer (toda la tienda) | Público | [Bolsa y side-cart](./bolsa-y-side-cart.md)                         |
| `/bolsa`                | Público | [Creación de pedidos](../pedidos/creacion-y-whatsapp.md) (checkout) |

API: `GET /v1/products/:slug` (público). La bolsa no llama a la API hasta crear el pedido.

## Mapa de código

```text
src/app/(store)/productos/[slug]/page.tsx     # Server Component: carga el producto
src/components/shop/
  ProductDetail.tsx                           # ficha completa (cliente)
  ProductImageModal.tsx                       # visor con zoom
  CartProvider.tsx                            # estado de la bolsa (useSyncExternalStore + localStorage)
src/components/StoreShell.tsx                 # monta CartProvider y SideCartDrawer
src/modules/catalog/ui/components/
  VariantSelector.tsx
  StockAlertBadge.tsx
src/modules/inventory/application/CheckStockUseCase.ts   # checkStock (puro)
src/modules/orders/domain/cart.ts             # reglas puras de la bolsa
src/modules/orders/ui/components/             # CartItemRow, HoldNotice
src/shared/ui/SideCartDrawer.tsx              # drawer lateral
supabase/functions/_shared/contracts.ts       # CatalogProduct
```

## Trazabilidad de tickets

| Ticket | Alcance                                | Documento                                                     | Estado                                            |
| ------ | -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| PDP-01 | Modelo de datos de producto extendido  | [Modelo de datos](./modelo-de-datos.md)                       | Implementado (tipo de dominio en `contracts.ts`)  |
| PDP-02 | Ficha de producto y galería multimedia | [Ficha y galería](./ficha-y-galeria.md)                       | Implementado; sin acordeones de envío ni cuidados |
| PDP-03 | Selector de variantes y disponibilidad | [Variantes y disponibilidad](./variantes-y-disponibilidad.md) | Implementado                                      |
| PDP-04 | Side-cart y retención temporal         | [Bolsa y side-cart](./bolsa-y-side-cart.md)                   | Implementado sin Zustand; retención informativa   |

Checklist original, verificada: cambiar de variante actualiza el stock y el botón al instante · el drawer se abre al agregar sin saltos de scroll · la bolsa persiste al recargar · el dinero se calcula en centavos enteros.

## Verificación del módulo

```bash
npm run test:unit      # cart, check-stock
npm run test:browser   # pdp-variants, storefront
npm run lint
npm run check-types
npm run build
```

No hay migraciones ni variables de entorno propias del módulo. Usa las públicas de Supabase para llamar a la API.
