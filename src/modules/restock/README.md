# Módulo Restock

Formulario «Avísame cuando vuelva» (LOG-04) y lógica pura del panel de reposición (LOG-06). Suscripciones, cola de avisos y envío con Resend viven en `supabase/functions/_shared/restock/`.

```text
src/modules/restock/
├── domain/restock-form.ts   # validación zod compartida con la API, mensajes, resultado de la API, recordar correo
├── domain/restock-admin.ts  # filtros, etiquetas y textos del panel de reposición
└── ui/RestockForm.tsx       # formulario en línea (cliente), se monta con key={variantId}
```

Documentación completa: **[Restock y notificaciones](../../../docs/modulos/pedidos/restock-y-notificaciones.md)**.
