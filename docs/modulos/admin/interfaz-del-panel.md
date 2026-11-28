# Interfaz del panel

> Módulo: [Administración](./README.md) · Transversal a todas las pantallas del backoffice

Estructura visual, navegación y componentes compartidos del panel. No cambia contratos de API ni requiere migraciones o variables de entorno.

## Layouts

- El layout raíz (`src/app/layout.tsx`) solo aporta fuentes y estilos globales.
- `(store)` monta los proveedores de carrito y catálogo de la tienda; `(admin)` monta únicamente el entorno administrativo (`src/app/(admin)/layout.tsx`, `admin.css`).
- `admin/(access)/layout.tsx` (login, recuperar, restablecer) reutiliza `StoreShell`: cabecera, navegación, pie y proveedores comerciales.
- `admin/(protected)/layout.tsx` valida la sesión con `requireAdmin()`, pasa el rol a `AdminNavigation` y muestra el enlace «Saltar al contenido» y el botón «Cerrar sesión».

## Navegación por rol

`src/components/admin/admin-sections.ts` define las secciones y si OPERATOR las ve. `adminHref()` construye las URLs con el prefijo `/140210`.

| Sección    | Ruta                 | ADMIN | OPERATOR | Documentación                                                      |
| ---------- | -------------------- | :---: | :------: | ------------------------------------------------------------------ |
| Inicio     | `/140210`            |   ✓   |    ✓     | Esta página                                                        |
| Productos  | `/140210/productos`  |   ✓   |          | [Catálogo e inventario](./catalogo-e-inventario.md)                |
| Inventario | `/140210/inventario` |   ✓   |    ✓     | [Catálogo e inventario](./catalogo-e-inventario.md)                |
| Órdenes    | `/140210/ordenes`    |   ✓   |    ✓     | [Estados e historial](../pedidos/estados-e-historial.md)           |
| Reposición | `/140210/restock`    |   ✓   |          | [Restock y notificaciones](../pedidos/restock-y-notificaciones.md) |
| Finanzas   | `/140210/finanzas`   |   ✓   |          | [Finanzas y márgenes](./finanzas.md)                               |
| Usuarios   | `/140210/usuarios`   |   ✓   |          | [Usuarios y Mi perfil](./usuarios-y-perfil.md)                     |
| Mi perfil  | `/140210/perfil`     |   ✓   |    ✓     | [Usuarios y Mi perfil](./usuarios-y-perfil.md)                     |

Ocultar una sección es solo presentación: cada página vuelve a exigir su permiso con `requireAdmin("<permiso>")` y la API lo valida de nuevo (ver [Autenticación y acceso](./autenticacion-y-acceso.md)).

- El inicio muestra accesos operativos sin consultar listados.
- Los enlaces del panel no precargan rutas automáticamente.

## Componentes compartidos

| Componente                     | Archivo                            | Uso                                                                                                                       |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AdminButton`, `AdminLink`     | `AdminButton.tsx`, `AdminLink.tsx` | Botones y enlaces con indicador de carga accesible                                                                        |
| `AdminHeading`, `AdminLoading` | `AdminFeedback.tsx`                | Encabezados de pantalla y estados de carga                                                                                |
| `AdminConsole`                 | `AdminConsole.tsx`                 | Pantalla de Inicio: tarjetas de acceso a las secciones permitidas para el rol                                             |
| `AdminModal`                   | `AdminModal.tsx`                   | Diálogo nativo: fondo inerte, scroll bloqueado, retorno de foco, Escape y confirmación de descarte dentro del mismo modal |
| `AdminNavigation`              | `AdminNavigation.tsx`              | Menú lateral filtrado por rol                                                                                             |

Todos viven en `src/components/admin/`. La carga diferida de los editores tiene un fallback local para no suspender ni recargar el catálogo completo.

## Comportamiento de datos

- Catálogo y Finanzas cargan las categorías al montarse, con reintento independiente (`useCategories.ts`).
- Las actualizaciones conservan el contenido visible mientras cargan.
- Órdenes evita consultas de fondo simultáneas, agrupa los eventos de foco y visibilidad cercanos, y refresca cada 30 segundos solo con la pestaña visible.

## Accesibilidad y carga

- El foco de los campos se dibuja sobre su propio borde. Botones, enlaces, casillas y otros controles conservan un indicador de teclado visible.
- Las pantallas y cargas iniciales usan las estrellas de `Loader` (`src/components/ui/Loader.tsx`); `Spinner` (`src/components/ui/Spinner.tsx`) se usa en botones y actualizaciones pequeñas. Ambos, igual que las animaciones, respetan el movimiento reducido.

## Pruebas

- `tests/admin-dashboard.browser.spec.ts`: escritorio y móvil, ausencia de consultas operativas en Inicio, carga y actualización de inventario, foco de campos y reintento de reposición.
- `tests/admin-modals.browser.spec.ts`, `tests/loader.browser.spec.ts`.
- Las pruebas navegan con el prefijo público `/140210` y comprueban que `/admin` devuelve 404.
