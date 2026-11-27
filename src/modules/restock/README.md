# Módulo Restock (frontend)

Formulario "Avísame cuando vuelva" de la ficha de producto (LOG-04). La persistencia, el límite de solicitudes y el envío de correos viven en Supabase (`POST /v1/restock`, `RestockSubscription`, `_shared/notifications.ts`). Ver [orders/README.md](../orders/README.md).

```text
src/modules/restock/
├── domain/restock-form.ts   # validación zod compartida con la API, mensajes de error, recordar correo
└── ui/RestockForm.tsx       # formulario en línea (cliente), se monta con key={variantId}
```

Pruebas: `tests/restock-form.test.ts` y `tests/pdp-variants.browser.spec.ts` (grupo "restock form (LOG-04)").
