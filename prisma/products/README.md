# Catálogo de prendas — 16 de noviembre de 2026

Se revisaron visualmente los 13 PNG originales. Se agruparon por modelo, con colores y tallas como variantes. Todos pertenecen a la categoría existente `tops`.

| Modelo                        | Colores                                 | Precio MXN | Variantes |
| ----------------------------- | --------------------------------------- | ---------- | --------- |
| Hoodie Alo                    | Azul marino, negro, gris jaspeado, café | 1999       | 12        |
| Suéter Alo Crew Neck          | Azul marino, negro, café, gris jaspeado | 1799       | 12        |
| Suéter Alo Quarter Zip        | Azul marino, negro                      | 1799       | 6         |
| Hoodie Essentials Fear of God | Azul oscuro, gris jaspeado, hueso       | 1999       | 9         |

Los precios fueron indicados por el usuario. Se interpretó quarter zip como suéter. El usuario confirmó que el crew neck gris es otro color del mismo modelo.

## Datos simulados autorizados

- Tallas CH, M y G para cada color; una unidad por combinación: 39 unidades en total.
- SKU internos únicos `LS-{modelo}-{color}-{talla}`.
- Códigos HEX aproximados a partir de la apariencia de las fotografías.

La simulación de tallas y existencias está autorizada por el usuario y debe sustituirse con inventario real cuando esté disponible. No se infieren composición, costo de compra ni medidas desde las fotos.

## Datos pendientes para completar las fichas

- Composición y cuidados según etiqueta: `Product.materials` y `specifications`.
- Medidas por talla: `SizeMeasurement` (pecho, cintura y cadera en cm); confirmar si son medidas corporales o de prenda antes de capturarlas.
- Costo de compra opcional: `ProductCost.costPrice`.
- Confirmar tallas, existencias y denominación comercial exacta de colores.
- Fotos frontales de Essentials y vistas traseras de Alo; las fotos Essentials actuales muestran la espalda. Algunas mangas ya están cortadas en los originales; no se reconstruyeron.
- No hay modelos humanos en las fotos: `modelHeightCm` y `modelSize` quedan vacíos.

## Imágenes y almacenamiento

Se conservan los PNG originales. `prepared/` contiene las 13 versiones WebP en marco 4:5. Las imágenes se almacenan en el bucket Supabase `product-images`; PostgreSQL guarda la ruta, texto alternativo y posición en `ProductImage`, no los binarios.

La galería es compartida por modelo: el esquema actual no relaciona `ProductImage` con una variante de color. Cada texto alternativo identifica el color correspondiente.

No se encontraron playeras en esta carpeta. La playera Essentials existente ya pertenece a `tops`; se conserva sin duplicarla ni cambiar su inventario.

## Archivos y comprobación

- `manifest.json`: lote reproducible con procedencia de los datos y asociación entre originales, imágenes, productos y variantes.
- `verification.json`: resultado de verificación de registros, API pública y contenido de imágenes.
- `node scripts/prepare-product-images.mjs`: preparar imágenes.
- `node scripts/import-product-batch.mjs`: comprobar conflictos sin escribir.
- `node scripts/import-product-batch.mjs --apply`: importar y publicar el lote autorizado.
- `node scripts/verify-product-batch.mjs --initial-stock`: verificar la carga inicial; omitir esa opción tras ventas o ajustes de inventario.

El importador conserva productos existentes y se detiene ante conflictos. Un lote ya cargado no se actualiza editando el manifiesto: los cambios posteriores requieren el flujo de edición del catálogo.
