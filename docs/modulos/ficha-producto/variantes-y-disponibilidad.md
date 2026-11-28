# Variantes y disponibilidad

> Ticket: **PDP-03** · Módulo: [Ficha de producto](./README.md) · Ruta: `/productos/[slug]`

Selector de talla y color con indicador de existencias y botón de compra que reacciona al stock de la variante elegida y a lo que ya hay en la bolsa.

## Regla de disponibilidad

`checkStock(variant, requestedQty = 1, inCart = 0)` en `src/modules/inventory/application/CheckStockUseCase.ts` es una función pura que comparten la ficha, el selector y la bolsa.

| Situación                                                  | `status`   | `reason`        | Etiqueta                                             | ¿Se puede comprar? |
| ---------------------------------------------------------- | ---------- | --------------- | ---------------------------------------------------- | :----------------: |
| Stock 0, variante archivada, inexistente o valor no válido | `out`      | `out_of_stock`  | «Agotado»                                            |         No         |
| Se pide más de lo que hay y la bolsa no tiene esa variante | `out`      | `out_of_stock`  | «Agotado»                                            |         No         |
| La bolsa ya tiene todo el stock disponible                 | `limit`    | `limit_in_cart` | «Ya tienes todas las piezas disponibles en tu bolsa» |         No         |
| Stock ≤ 2 (`LOW_STOCK_THRESHOLD`)                          | `low`      | `ok`            | «Última pieza» / «Últimas 2 piezas»                  |         Sí         |
| Resto                                                      | `in_stock` | `ok`            | — (se muestra «Disponible»)                          |         Sí         |

El stock se redondea hacia abajo y los valores negativos o no finitos cuentan como 0. Esta comprobación es solo de interfaz: la disponibilidad definitiva la decide la API al crear el pedido ([Creación de pedidos](../pedidos/creacion-y-whatsapp.md)).

## Selector

`src/modules/catalog/ui/components/VariantSelector.tsx`:

- Dos grupos (`role="group"`): tallas como _pills_ y colores como _swatches_ con `colorHex`. Cada opción usa `aria-pressed` y una etiqueta accesible que incluye «agotado» cuando aplica.
- Teclado con _roving tabindex_: ← → ↑ ↓, Inicio y Fin mueven la selección dentro del grupo.
- Las variantes archivadas no se muestran. Las opciones agotadas se marcan con tachado o diagonal, no solo con color.
- Si la combinación elegida no existe (por ejemplo, una talla que no hay en ese color), se conserva la nueva elección y se salta a la primera variante comprable con ese valor; si no hay ninguna, a la primera que exista.
- La ficha empieza con la primera variante no archivada.

`src/modules/catalog/ui/components/StockAlertBadge.tsx` muestra la etiqueta con un punto de color según el estado (`role="status"`, para que los lectores de pantalla anuncien el cambio).

## Botón de compra

En `src/components/shop/ProductDetail.tsx`:

- Si se puede comprar, «Agregar a la bolsa» añade una pieza con `maxQuantity = stock disponible` y abre el side-cart. Debajo aparece «Ya tienes N piezas de esta variante en tu bolsa».
- Con `limit_in_cart`, el botón queda deshabilitado con su mensaje.
- Con `out_of_stock`, el botón queda deshabilitado y aparece el formulario «Avísame cuando vuelva» (`RestockForm`, montado con `key={variant.id}`) y la sugerencia de elegir otra talla o color.

## Pruebas

- `tests/check-stock.test.ts`: niveles de stock, archivadas, negativos, valores fraccionarios o no finitos y límite por bolsa.
- `tests/pdp-variants.browser.spec.ts`: el selector actualiza la alerta y el botón, oculta las archivadas, maneja combinaciones inexistentes, respeta el stock en la bolsa y se opera con flechas.
