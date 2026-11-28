# Catálogo e inventario

> Ticket: **ADM-03** · Módulo: [Administración](./README.md) · Rutas: `/140210/productos` (ADMIN), `/140210/inventario` (ADMIN y OPERATOR)

Gestión de prendas y variantes, y una matriz de existencias por talla y color con guardado por lotes.

## Productos (`/140210/productos`)

Requiere `catalog:write` (solo ADMIN).

- Listado con búsqueda, categorías, filtro de activos, archivados o todos, y paginación.
- Crear, editar, archivar y restaurar productos y variantes. Las variantes nuevas empiezan con stock cero.
- Archivar conserva las unidades, las referencias y los snapshots de pedidos. Restaurar un producto **no** restaura las variantes que se archivaron una por una.

### Editor de producto (modal)

- Pestañas: _Datos esenciales_, _Fotografías_, _Detalles y medidas_ y _Completa el look_. El borrador se conserva al cambiar de pestaña.
- «Guardar» mantiene el editor abierto y «Guardar y cerrar» vuelve al catálogo. La Server Action `saveProduct` devuelve el producto guardado en `data` para actualizar el ID y la versión sin duplicados.
- El detalle se carga una vez por apertura; si falla, el guardado queda bloqueado hasta reintentar.
- _Completa el look_: hasta tres complementos, con portada y nombre, búsqueda diferida y paginación. Los candidatos se consultan al abrir esa pestaña.
- Las fotografías siguen el flujo de [Multimedia](./multimedia.md). Guardar y cerrar están bloqueados mientras hay subidas en curso.

### Editor de variantes (modal)

- Modal propio, con protección de cambios al cerrarlo o cambiar de variante.
- Después de una mutación se recarga el detalle; si esa lectura falla, se bloquean nuevas mutaciones hasta reintentar.
- El catálogo se refresca al cerrar solo si hubo guardados.

## Inventario (`/140210/inventario`)

Requiere `stock:write` (ADMIN y OPERATOR). OPERATOR consulta y actualiza existencias, pero no administra el catálogo ni las variantes.

- Matriz por prenda: tallas en filas y colores en columnas. Las celdas inexistentes muestran `—` y las archivadas son de solo lectura.
- El borrador registra solo las celdas modificadas de la página actual, hasta **100 por lote** (`src/modules/inventory/domain/stock-draft.ts`).
- Antes de cambiar filtros, de página o de enlace se ofrece guardar, descartar o cancelar. Al recargar o cerrar se usa la advertencia nativa del navegador. Los borradores viven solo en memoria.

## Contratos API

Prefijo: `/functions/v1/api/v1`. Las Server Actions de `src/modules/inventory/application/actions.ts` (`saveProduct`, `setProductArchived`, `saveVariant`, `updateStock`) autentican, autorizan y validan antes de llamar a la API con el token del usuario. Prisma y las credenciales privilegiadas solo existen en el backend.

| Método y ruta               | Permiso       | Contrato                                                                                                                                     |
| --------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/products`       | catalog:read  | `state=active\|archived\|all`; si se omite equivale a `all` (compatibilidad).                                                                |
| `GET /admin/products/:id`   | catalog:read  | Detalle completo con complementos (lo carga el editor al abrirse).                                                                           |
| `POST /admin/products`      | catalog:write | Crear producto.                                                                                                                              |
| `PUT /admin/products/:id`   | catalog:write | Editar producto con versión optimista obligatoria.                                                                                           |
| `PATCH /admin/products/:id` | catalog:write | `{ version, isArchived }`: archivar o restaurar.                                                                                             |
| `POST /admin/variants`      | catalog:write | Crear variante (stock 0).                                                                                                                    |
| `PATCH /admin/variants/:id` | catalog:write | Talla, color, hexadecimal, SKU y estado, con versión obligatoria. No cambia el stock ni el producto propietario.                             |
| `PATCH /admin/stock`        | stock:write   | `{ changes: [{ id, version, stock }] }`. Transacción serializable, versiones optimistas, enteros 0–100000, rollback completo ante conflicto. |

- Se rechazan cambios de stock sobre productos o variantes archivados.
- Reponer desde cero mantiene el outbox transaccional que dispara los avisos de reposición (ver [Restock y notificaciones](../pedidos/restock-y-notificaciones.md)).
- OPERATOR recibe el catálogo **sin costos**; los costos solo se exponen en [Finanzas](./finanzas.md).

## Código

| Pieza                   | Ubicación                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Páginas                 | `src/app/(admin)/admin/(protected)/productos/`, `inventario/`                                                                                                                        |
| Catálogo y editores     | `src/components/admin/CatalogWorkspace.tsx`, `ProductEditor.tsx`, `ProductDetailsSection.tsx`, `ProductLookSection.tsx`, `VariantEditor.tsx`, `product-draft.ts`, `useCategories.ts` |
| Matriz de inventario    | `src/components/admin/InventoryMatrix.tsx`                                                                                                                                           |
| Server Actions          | `src/modules/inventory/application/actions.ts`                                                                                                                                       |
| Borrador de stock       | `src/modules/inventory/domain/stock-draft.ts`                                                                                                                                        |
| Lógica de negocio (API) | `supabase/functions/_shared/service.ts`, `contracts.ts`                                                                                                                              |

## Despliegue

No añade migraciones de esquema ni credenciales nuevas en Next.js. Publicar primero las Edge Functions con contratos compatibles y después Next.js. Verificar ambos roles en staging antes de producción.

## Pruebas

`tests/inventory.test.ts`, `tests/inventory.browser.spec.ts`, `tests/admin-modals.browser.spec.ts` y los escenarios ADM-03 de `tests/integration.ts`, además de las regresiones de autenticación y pedidos.
