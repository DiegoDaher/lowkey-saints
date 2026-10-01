# Módulo 3: Backoffice Admin, Inventario & Finanzas

- **Responsable:** Desarrollador 3
- **Rama:** `feature/admin-inventory-finance`
- **Alcance:** Gestión operativa, autenticación administrativa, catálogo masivo y márgenes comerciales.

---

## Reglas de Arquitectura

- Todas las rutas deben vivir dentro del route group `src/app/(admin)/`.
- La lógica de cálculo financiero no debe residir en los componentes UI, sino en `src/modules/inventory/domain/` o `application/`
