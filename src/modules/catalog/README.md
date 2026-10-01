# Módulo 1: Landing Page & Catálogo Interactivo

- **Responsable:** Desarrollador 1
- **Rama:** `feature/catalog-landing`
- **Alcance:** Experiencia de descubrimiento, exploración visual y conversión inicial para tráfico digital.

---

## Reglas de Arquitectura

- **Cero fugas de Prisma en UI:** Las consultas deben ejecutarse en Server Components o dentro de `src/modules/catalog/application/` e `infra/`.
- Importar utilidades y componentes base desde `@shared/ui` y cliente DB desde `@server/db/prisma`.
