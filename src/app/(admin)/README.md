# Módulo 3: Backoffice Admin, Inventario & Finanzas

- **Rama sugerida:** `feat/admin-inventory-finance`
- **Módulo:** `src/modules/inventory` & `src/app/(admin)`
- **Alcance:** Entorno privado de administración para gestión operativa, control financiero y catálogo masivo.

---

## Tareas y Requerimientos

### [ADM-01] Autenticación Administrativa

- **Objetivo:** Panel de acceso seguro y protección perimetral de rutas administrativas.
- **Entregables:**
  - Login administrativo en `src/app/(admin)/login/page.tsx` integrando Supabase Auth.
  - `src/server/auth/supabase.ts`: Validación de sesión en servidor con `@supabase/ssr`.
  - Middleware de protección en `src/middleware.ts` para denegar tráfico anónimo en `/(admin)/*`.

### [ADM-02] Control de Acceso por Roles (RBAC) y RLS

- **Objetivo:** Restricción de acciones basada en roles (`ADMIN`, `OPERATOR`).
- **Entregables:**
  - Políticas de Row Level Security (RLS) en `supabase/migrations` para tablas sensibles (`ProductCost`, `OrderFinancials`).
  - Verificación de claims/rol en Server Actions y layout administrativo.

### [ADM-03] Módulo CRUD de Catálogo y Matriz de Inventario

- **Objetivo:** Formularios de creación/edición de prendas y matriz interactiva de stock.
- **Entregables:**
  - `src/app/(admin)/inventario/page.tsx`: Matriz visual cruzando Tallas (Filas) vs Colores (Columnas) para actualización rápida de existencias.
  - Server Actions en `src/modules/inventory/application/actions.ts` con transacciones de Prisma para updates masivos de stock.
  - Borrado lógico (`isArchived: true`) para no romper órdenes históricas.

### [ADM-04] Carga Múltiple de Archivos (Multimedia de Producto)

- **Objetivo:** Subida de imágenes de producto a almacenamiento en la nube.
- **Entregables:**
  - Integración en `src/server/storage/` con Supabase Storage o Cloudinary.
  - Drag and drop en UI de administración con compresión previa en cliente o generación de miniaturas.
  - Persistencia de URLs públicas en la entidad `ProductImage` mediante Prisma.

### [ADM-05] Financial Accounting y Análisis de Márgenes

- **Objetivo:** Captura de costos unitarios y cálculo de rentabilidad bruta.
- **Entregables:**
  - Campos en esquema Prisma: `costPrice` (costo interno directo) y `salePrice` (precio retail).
  - Cálculo de margen bruto unitario: `Margen = ((salePrice - costPrice) / salePrice) * 100`.
  - `src/app/(admin)/finanzas/page.tsx`: Vista con indicadores clave (KPIs), porcentaje de margen promedio y alertas visuales de productos con bajo margen o margen negativo.

---

## Estructura del Módulo

```text
src/
├── app/(admin)/
│   ├── layout.tsx                # Sidebar admin y validación de rol
│   ├── inventario/page.tsx       # Matriz de stock
│   ├── productos/page.tsx        # CRUD de catálogo
│   └── finanzas/page.tsx         # Dashboard financiero
├── modules/inventory/
│   ├── application/
│   │   ├── UpdateStockMatrixUseCase.ts
│   │   └── CalculateFinancialMarginsUseCase.ts
│   ├── domain/InventoryVariant.ts
│   └── infra/PrismaInventoryRepository.ts
```

## Checklist de Verificación

[ ] Ningún usuario no autenticado puede acceder a ninguna ruta bajo /(admin).

[ ] La matriz de inventario permite guardar cambios en bloque sin enviar requests redundantes.

[ ] El costo interno (costPrice) jamás se expone en endpoints o serializadores públicos del catálogo.

[ ] Las imágenes eliminadas en el panel se desvinculan o eliminan del bucket de almacenamiento.
