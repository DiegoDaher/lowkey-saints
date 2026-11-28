# Modelo de datos del producto

> Ticket: **PDP-01** · Módulo: [Ficha de producto](./README.md)

Atributos completos de una prenda: textos editoriales, materiales, guía de tallas, fotografías, variantes y complementos.

> **Diferencia con la especificación original:** no existe `src/modules/catalog/domain/ProductDetails.ts`. El tipo de dominio compartido entre la web y la API es `CatalogProduct` en `supabase/functions/_shared/contracts.ts`.

## Modelos (`prisma/schema.prisma`)

| Modelo              | Campos relevantes                                                                                                                                      | Notas                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `Product`           | `name`, `slug` (único), `description`, `materials`, `specifications`, `salePrice` Decimal(10,2), `modelHeightCm`, `modelSize`, `isArchived`, `version` | Los textos tienen `""` por defecto. `version` sirve para la edición optimista.                                                 |
| `ProductVariant`    | `size`, `color`, `colorHex`, `sku` (único), `stock`, `isArchived`, `version`                                                                           | Única por `(productId, size, color)`.                                                                                          |
| `ProductImage`      | `path`, `alt`, `position`                                                                                                                              | Única por `(productId, position)`. La URL pública se deriva de `path` al responder (ver [Multimedia](../admin/multimedia.md)). |
| `SizeMeasurement`   | `size`, `chestCm`, `waistCm`, `hipCm`                                                                                                                  | Guía de tallas en cm; única por `(productId, size)`.                                                                           |
| `ProductComplement` | `productId`, `complementaryId`, `position`                                                                                                             | «Completa el look»: hasta tres complementos ordenados.                                                                         |
| `ProductCategory`   | relación M:N con `Category`                                                                                                                            | Ver el módulo de catálogo.                                                                                                     |

El costo (`ProductCost`) vive en una tabla aparte y **nunca** se incluye en las respuestas públicas (ver [Finanzas](../admin/finanzas.md)).

## Contrato público

`GET /functions/v1/api/v1/products/:slug` (público, sin autenticación):

- Devuelve solo productos no archivados; si no existe o está archivado, **404** «Producto no encontrado».
- Incluye imágenes ordenadas (con `url`), categorías, medidas, **variantes no archivadas** y complementos no archivados (cada uno con sus propias imágenes y variantes).
- Tipo: `CatalogProduct` (`supabase/functions/_shared/contracts.ts`). Los importes llegan como cadenas decimales (`salePrice`, medidas).

La página `src/app/(store)/productos/[slug]/page.tsx` es un Server Component que llama a este endpoint con `api()` (`src/lib/api.ts`) y muestra el error en un `role="alert"` si falla.

## Captura

Los textos, medidas, datos del modelo y complementos se editan en el Backoffice, en las pestañas _Detalles y medidas_ y _Completa el look_ del editor de producto (ver [Catálogo e inventario](../admin/catalogo-e-inventario.md)). Contrato de escritura: `productInput` en `contracts.ts`.

## Migraciones

Los campos editoriales, `SizeMeasurement`, `ProductComplement` y `ProductImage` forman parte de las migraciones iniciales (requisitos BD-04 a BD-11 de [Base de datos](../../general/base-de-datos.md)). `ProductMediaAsset` y la FK desde `ProductImage.path` llegan con `202611180001_product_media`.
