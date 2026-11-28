# Módulo 4: Pedidos WhatsApp, Automatización & Restock

Creación de pedidos con enlace de WhatsApp, estados e historial, expiración de reservas con el worker `jobs` y avisos de reposición por correo.

La documentación completa del módulo (flujos, contratos de API, datos, configuración, despliegue, pruebas y trazabilidad de los tickets LOG-01 a LOG-06) vive en **[docs/modulos/pedidos](../../../docs/modulos/pedidos/README.md)**.

Aquí solo vive la parte de la web: `domain/cart.ts` (reglas de la bolsa, ver [Bolsa y side-cart](../../../docs/modulos/ficha-producto/bolsa-y-side-cart.md)) y `ui/components/`. El backend está en `supabase/functions/_shared/orders/` y `_shared/restock/`.

Al cambiar este módulo, actualiza la página de la funcionalidad correspondiente y la tabla de trazabilidad de ese README.
