# Ficha de producto y galería

> Ticket: **PDP-02** · Módulo: [Ficha de producto](./README.md) · Ruta: `/productos/[slug]` · Acceso: público

Vista detallada de una prenda: galería con zoom, selector de variantes, compra, textos editoriales, guía de tallas y «Completa el look».

> **Diferencia con la especificación original:** la ruta es `src/app/(store)/productos/[slug]/page.tsx`, no `(public)/producto/[slug]`. No hay acordeones de envío ni de cuidados; esa información vive en las páginas `/envios` y `/preguntas-frecuentes`.

## Estructura de la página

`src/components/shop/ProductDetail.tsx` (Client Component), en orden:

1. **Galería**: imagen principal y miniaturas de todas las fotos (`p.images`). Al pulsar una miniatura cambia la principal; al pulsar la principal («Ampliar imagen», cursor `zoom-in`) se abre el visor.
2. **Nombre, precio** (formateado desde centavos) **y descripción**, seguidos del selector de variantes con su alerta de disponibilidad (ver [Variantes y disponibilidad](./variantes-y-disponibilidad.md)).
3. **Botón «Agregar a la bolsa»**, que abre el side-cart (ver [Bolsa y side-cart](./bolsa-y-side-cart.md)). Si la variante está agotada, aparece el formulario «Avísame cuando vuelva» ([Restock](../pedidos/restock-y-notificaciones.md)).
4. **Materiales** y **Especificaciones**: se muestran solo si tienen contenido, con el estilo `.store-receipt` (borde dorado a la izquierda).
5. **Guía de tallas · cm**: tabla de `measurements` (pecho, cintura y cadera por talla) y, si existe, «Modelo: &lt;altura&gt; cm · Talla &lt;talla&gt;».
6. **Completa el look**: tarjetas de los complementos con enlace a su ficha (`/productos/<slug>`). Solo aparece si hay complementos.

## Visor con zoom

`src/components/shop/ProductImageModal.tsx`:

- Zoom de 1× a 3× con la rueda del ratón y arrastre para desplazarse cuando hay zoom.
- Navegación con ← y →, botones Anterior/Siguiente e indicadores de punto.
- Se cierra con Escape o con un clic en el fondo.
- Pendientes conocidos: el pellizco táctil en móvil y los atajos de teclado para el zoom.

## Datos

La página no hace consultas desde el cliente: recibe el `CatalogProduct` completo del Server Component (ver [Modelo de datos](./modelo-de-datos.md)). No requiere migraciones ni dependencias nuevas.

## Pruebas

- `tests/pdp-variants.browser.spec.ts`: ficha completa con API simulada, incluido «no horizontal overflow on mobile».
- `tests/storefront.browser.spec.ts`: navegación y layout de la tienda en varios anchos.
