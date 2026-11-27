# Módulo Restock

Formulario "Avísame cuando vuelva" de la ficha de producto (LOG-04) y reglas de suscripción (LOG-05). La persistencia, el límite de solicitudes y el envío de correos viven en Supabase (`POST /v1/restock`, `RestockSubscription`, `_shared/notifications.ts`). Ver [orders/README.md](../orders/README.md) para el contrato completo.

```text
src/modules/restock/
├── domain/restock-form.ts   # validación zod compartida con la API, mensajes, resultado de la API, recordar correo
└── ui/RestockForm.tsx       # formulario en línea (cliente), se monta con key={variantId}

supabase/functions/_shared/restock/
├── domain/RestockSubscriptionPolicy.ts       # una suscripción por correo y variante
├── application/SubscribeToRestockUseCase.ts  # transacción, 404/409, carrera P2002
└── infra/RestockEmail.ts                     # correo HTML + texto
```

Estados de la UI: formulario → enviando → confirmación ("Listo, te avisaremos" / "Ya estabas en la lista" / "Avisos reactivados"), o pregunta de reactivación si el correo se dio de baja antes. La baja se confirma en `/baja?token=…`.

Pruebas: `tests/restock-form.test.ts`, `tests/restock-subscription.test.ts`, `tests/restock-email.test.ts`, la sección restock de `tests/integration.ts`, el grupo "restock form (LOG-04)" de `tests/pdp-variants.browser.spec.ts` y `/baja` en `tests/loader.browser.spec.ts`.
