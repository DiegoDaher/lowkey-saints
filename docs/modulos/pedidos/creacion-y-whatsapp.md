# Creación de pedidos y enlace de WhatsApp

> Ticket: **LOG-01** · Módulo: [Pedidos y restock](./README.md) · Ruta: `/bolsa` · Acceso: público

Convierte la bolsa en un pedido persistido con stock reservado y genera un enlace `wa.me` para que el comprador envíe el pedido por WhatsApp. **No es WhatsApp Business API**: nada se envía automáticamente.

## Flujo

1. En `/bolsa` el comprador captura su nombre y teléfono y pulsa enviar. La bolsa vive en el navegador (ver [Bolsa y side-cart](../ficha-producto/bolsa-y-side-cart.md)).
2. El navegador genera una **clave de idempotencia** (`crypto.randomUUID()`) y la guarda en `localStorage` (`lowkey-pending-order`) junto con la firma del pedido. Si se reintenta con los mismos datos, se reutiliza la clave; si cambian, se genera una nueva.
3. `POST /v1/orders` crea el pedido. Con éxito, la bolsa se vacía, se borra la clave pendiente y aparece **Continuar en WhatsApp**.
4. Ante un error se conservan la bolsa y la clave para reintentar sin duplicar el pedido.

## Reglas de creación

`CreateOrderUseCase` (`supabase/functions/_shared/orders/application/CreateOrderUseCase.ts`), ejecutado en una transacción serializable con hasta 3 reintentos ante conflictos de serialización (`ShopService.atomic`):

- Une las líneas repetidas de la misma variante (`mergeItems`).
- Cada variante debe existir y no estar archivada (ni ella ni su producto); si no, **409** «Producto no disponible».
- Descuenta el stock con una actualización condicionada (`stock >= cantidad`); si no alcanza, **409** «Existencias insuficientes para &lt;SKU&gt;».
- **El precio lo decide el servidor**: usa `Product.salePrice` de la base de datos, no el precio del navegador.
- Guarda copias históricas en `OrderItem` (nombre, SKU, talla, color y precio).
- Crea el pedido en `PENDING_PAYMENT`, moneda `MXN`, con `expiresAt` = ahora + **24 horas**, y el primer evento de historial (`CHECKOUT`).

### Idempotencia

- `Order.idempotencyKey` es único y `requestHash` guarda el hash de nombre, teléfono y líneas.
- Repetir la misma clave con los mismos datos devuelve el pedido existente. Con datos distintos responde **409** «La clave del pedido ya se utilizó con otros datos».
- Si dos peticiones simultáneas chocan (P2002), la segunda devuelve el pedido ya creado.

## Contrato API

`POST /functions/v1/api/v1/orders`

```json
{
  "idempotencyKey": "uuid",
  "clientName": "texto (máx. 100)",
  "clientPhone": "8–15 dígitos; se aceptan +, espacios, paréntesis y guiones",
  "items": [{ "variantId": "uuid", "quantity": 1 }]
}
```

- `items`: de 1 a 50 líneas y cantidades de 1 a 20. El cuerpo es estricto (`orderInput` en `supabase/functions/_shared/contracts.ts`).
- Respuesta **201**: `{ id, orderNumber, status, totalAmount, expiresAt, whatsappUrl }`.
- **503** «Pedidos aún no disponibles» si `WHATSAPP_PHONE` no está configurado o no es válido. Se comprueba **antes** de reservar stock.
- Límites: 5 pedidos por teléfono (hash), además de los límites generales de escritura (20 por IP, 1000 globales). Ver [Seguridad de APIs](../../seguridad-apis.md).

## Mensaje de WhatsApp

`WhatsAppMessageSerializer` (`supabase/functions/_shared/orders/infra/`) es una función pura que recibe el teléfono comercial ya validado y el pedido persistido:

```text
Hola, mi pedido es #<orderNumber>
<clientName>
<cantidad> × <producto> / <talla> / <color>
Total: $<total> MXN
Reserva hasta <expiresAt ISO>
```

El texto se codifica con `encodeURIComponent` (acentos, saltos de línea como `%0A` y caracteres especiales) y se devuelve como `https://wa.me/<telefono>?text=…`.

## Configuración

| Variable         | Dónde          | Uso                                                       |
| ---------------- | -------------- | --------------------------------------------------------- |
| `WHATSAPP_PHONE` | Edge Functions | Teléfono comercial; se limpian `+`, espacios, `()` y `-`. |

No requiere migraciones ni dependencias nuevas.

## Pruebas

- `tests/domain.test.ts`: URL de WhatsApp y codificación de caracteres especiales, unión de variantes repetidas, límites de cantidad y rechazo de precios enviados por el cliente.
- `tests/shop.browser.spec.ts`: bolsa persistente y recibo del pedido (con y sin reintento) usando API simulada.
- `tests/integration.ts`: reserva concurrente, idempotencia y rollback sobre PostgreSQL desechable.
