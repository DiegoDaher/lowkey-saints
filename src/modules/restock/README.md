# Módulo Restock

Formulario "Avísame cuando vuelva" de la ficha de producto (LOG-04), reglas de suscripción (LOG-05) y servicio asíncrono de avisos con Resend (LOG-06). La persistencia, el límite de solicitudes y el envío de correos viven en Supabase (`POST /v1/restock`, `RestockSubscription`, `Notification`, función `jobs`). Ver [orders/README.md](../orders/README.md) para el contrato completo.

```text
src/modules/restock/
├── domain/restock-form.ts   # validación zod compartida con la API, mensajes, resultado de la API, recordar correo
├── domain/restock-admin.ts  # filtros, etiquetas y textos del Backoffice de reposición (LOG-06)
└── ui/RestockForm.tsx       # formulario en línea (cliente), se monta con key={variantId}

supabase/functions/_shared/restock/
├── domain/RestockSubscriptionPolicy.ts       # una suscripción por correo y variante
├── domain/NotificationDeliveryPolicy.ts      # intentos, backoff, ventana de idempotencia, reintentos
├── application/SubscribeToRestockUseCase.ts  # transacción, 404/409, carrera P2002
├── application/NotifyBackInStockUseCase.ts   # encolar al reabastecer o desarchivar
├── application/DeliverRestockNotificationsUseCase.ts # worker de la cola (jobs)
├── application/RetryRestockNotificationUseCase.ts    # reintentos del Backoffice
├── infra/ResendMailer.ts                     # adaptador fetch de Resend
└── infra/RestockEmail.ts                     # correo HTML + texto
```

Estados de la UI: formulario → enviando → confirmación ("Listo, te avisaremos" / "Ya estabas en la lista" / "Avisos reactivados"), o pregunta de reactivación si el correo se dio de baja antes. La baja se confirma en `/baja?token=…`.

Pruebas: `tests/restock-form.test.ts`, `tests/restock-subscription.test.ts`, `tests/restock-email.test.ts`, la sección restock de `tests/integration.ts`, el grupo "restock form (LOG-04)" de `tests/pdp-variants.browser.spec.ts` y `/baja` en `tests/loader.browser.spec.ts`.
