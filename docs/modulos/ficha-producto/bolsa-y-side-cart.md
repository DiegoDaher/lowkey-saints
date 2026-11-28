# Bolsa y side-cart

> Ticket: **PDP-04** · Módulo: [Ficha de producto](./README.md) · Rutas: drawer en toda la tienda, `/bolsa` (checkout)

Bolsa de compra que vive en el navegador, con un panel lateral que se abre al agregar un producto y un aviso informativo de 60 minutos.

> **Decisiones que se apartan de la especificación original:**
>
> - **Sin Zustand.** Se conserva el store sin dependencias con `useSyncExternalStore` en `CartProvider`; solo se renombró la clave a `cart-storage`.
> - **La retención es informativa.** Al vencer los 60 minutos se avisa, pero nunca se vacía la bolsa. La reserva real (24 h) ocurre en el servidor al crear el pedido.
> - El ícono de bolsa del header abre el drawer (con contador); `/bolsa` sigue siendo la página de checkout.

## Estado y persistencia

`src/components/shop/CartProvider.tsx` (montado en `src/components/StoreShell.tsx`, el layout de la tienda):

- Persiste `{ items, heldAt }` en `localStorage` con la clave `cart-storage`.
- Sincroniza las pestañas abiertas con el evento `storage` y un evento propio para la pestaña actual.
- Migra una sola vez el formato antiguo (`lowkey-cart`) y lo elimina.
- API de `useCart()`: `items`, `heldAt`, `count` (piezas, para el contador del header), `subtotalCents`, `add(line, { open = true })`, `setQuantity`, `remove`, `clear`, `openCart`, `closeCart`, `isOpen`.

## Reglas puras

`src/modules/orders/domain/cart.ts`:

| Regla              | Detalle                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Dinero en centavos | `toCents` convierte la cadena decimal de la API sin aritmética de punto flotante; subtotales y totales de línea son enteros. |
| Límite por línea   | `min(stock disponible al agregar, 20)` (`MAX_PER_LINE`).                                                                     |
| Unir líneas        | Agregar una variante que ya está en la bolsa suma a su línea, recortando al límite.                                          |
| Retención          | `HOLD_MS` = 60 min. Cada vez que se agrega se reinicia `heldAt`; si la bolsa queda vacía, `heldAt` vuelve a `null`.          |
| Lectura segura     | `parseCartState` descarta líneas inválidas o JSON corrupto y devuelve una bolsa vacía.                                       |

## Drawer

`src/shared/ui/SideCartDrawer.tsx`: un `<dialog>` lateral montado una sola vez en `StoreShell`.

- Se abre al agregar desde la ficha, con «Ver bolsa» y con el ícono del header. Al abrir, el foco va al botón de cerrar.
- Se cierra con Escape, con un clic en el fondo o con «Seguir comprando», y devuelve el foco al elemento que lo abrió.
- `scrollbar-gutter: stable` en `html` evita que la página salte al bloquear el scroll. La animación respeta `prefers-reduced-motion`.
- Muestra el aviso de retención, las líneas, el subtotal y un enlace a `/bolsa`.

Componentes compartidos por el drawer y `/bolsa` (`src/modules/orders/ui/components/`):

- `CartItemRow.tsx`: miniatura, stepper −/+, quitar y total de línea.
- `HoldNotice.tsx`: minutos restantes (se refresca cada 15 s). Al vencer: «Tu selección ya no está apartada…».

Los componentes compartidos de la tienda que no pertenecen a un módulo viven en `src/shared/ui`.

## Relación con el pedido

La bolsa no reserva stock. Al enviar el formulario de `/bolsa`, la API vuelve a validar existencias y precios y reserva durante 24 horas (ver [Creación de pedidos y WhatsApp](../pedidos/creacion-y-whatsapp.md)). El contrato `POST /v1/orders` no cambió con PDP-04.

## Pruebas

- `tests/cart.test.ts`: `toCents`, subtotales exactos, unión y recorte de líneas, retención de 60 min, lectura segura y migración de `lowkey-cart`.
- `tests/pdp-variants.browser.spec.ts`: el drawer se abre al agregar, edita cantidades en centavos y persiste al recargar; la retención vencida avisa sin vaciar la bolsa.
