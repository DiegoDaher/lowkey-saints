# Módulo 2: Ficha de Producto & Carrito Lateral (Side-Cart)

- **Responsable:** Desarrollador 2
- **Rama:** `feature/pdp-sidecart`
- **Alcance:** Experiencia de selección detallada, especificaciones técnicas y retención de compra previa al pedido.

---

## Reglas de Arquitectura

- El Side-Cart debe ser un componente cliente colocado estratégicamente en el layout raíz o público (`src/app/(public)/layout.tsx`).
- No acoplar el carrito a la lógica directa de base de datos; interactúa solo con DTOs de variantes.
