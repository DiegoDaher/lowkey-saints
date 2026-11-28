# Módulos

Cada módulo de negocio tiene su carpeta con un `README.md` (rutas, mapa de código, permisos, trazabilidad de tickets y verificación) y una página por funcionalidad. Los tickets se usan solo como referencia; la documentación se organiza por funcionalidad.

| Módulo                                | Tickets | Rutas principales                                       | Código                                                                                                      | Documentación                                                                                                                             |
| ------------------------------------- | ------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Landing y catálogo                | CAT     | `/`                                                     | `src/components/catalog`, `src/modules/catalog`, `_shared/catalog`                                          | Pendiente de migrar: [src/modules/catalog/README.md](../../src/modules/catalog/README.md) · [catalogo-landing.md](../catalogo-landing.md) |
| 2 · Ficha de producto y side-cart     | PDP     | `/productos/[slug]`, `/bolsa`                           | `src/modules/catalog/ui`, `src/modules/orders/domain/cart.ts`, `src/shared/ui`                              | **[ficha-producto/](./ficha-producto/README.md)**                                                                                         |
| 3 · Administración                    | ADM     | `/140210/*`                                             | `src/app/(admin)`, `src/components/admin`, `src/modules/inventory`                                          | **[admin/](./admin/README.md)**                                                                                                           |
| 4 · Pedidos, automatización y restock | LOG     | `/bolsa`, `/baja`, `/140210/ordenes`, `/140210/restock` | `src/modules/orders`, `src/modules/restock`, `_shared/orders`, `_shared/restock`, `supabase/functions/jobs` | **[pedidos/](./pedidos/README.md)**                                                                                                       |

`_shared/…` se refiere a `supabase/functions/_shared/`.

## Plantilla de un módulo

```text
docs/modulos/<modulo>/
├── README.md            # resumen, rutas, mapa de código, permisos, trazabilidad, verificación
└── <funcionalidad>.md   # una página por funcionalidad
```

Secciones de cada página de funcionalidad (incluir solo las que apliquen): encabezado con el ticket y el acceso · propósito · flujo de usuario · contratos API · datos y migraciones · permisos · código · despliegue · pruebas · decisiones y limitaciones.

## Plan de migración

| Fase | Módulo            | Páginas previstas                                                                                        |
| ---- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| 1 ✓  | Administración    | Hecho                                                                                                    |
| 2 ✓  | Pedidos           | Hecho                                                                                                    |
| 3 ✓  | Ficha de producto | Hecho                                                                                                    |
| 4    | `catalogo/`       | `landing-y-diseno.md` (CAT-01/02), `modelo-de-tarjetas.md` (CAT-03), `filtros-y-busqueda.md` (CAT-04/05) |
| 5    | `../general/`     | `api.md`, `jobs.md`, `pruebas.md`, `despliegue-y-entorno.md`                                             |
