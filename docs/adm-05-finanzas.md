# ADM-05: Finanzas y análisis de márgenes

## Arquitectura y acceso

La vista `/140210/finanzas` corresponde a `src/app/(admin)/admin/(protected)/finanzas/page.tsx`. El proxy conserva el rewrite `/140210` a `/admin` y rechaza el acceso directo a `/admin` con 404. Login, recuperación y confirmación siguen fuera del layout protegido. La página exige `finances`; las Server Actions y cada petición Edge validan sesión, perfil activo y permiso ADMIN. OPERATOR no recibe datos financieros.

Next.js presenta la interfaz y transmite mutaciones autenticadas. `CalculateFinancialMarginsUseCase` vive en `supabase/functions/_shared/inventory/application/`; Prisma y credenciales privilegiadas permanecen en Edge Functions. `CatalogProduct` y serializadores públicos no incluyen costos ni configuración financiera.

## Datos y reglas

Se conservan `Product.salePrice` y `ProductCost.costPrice`, decimales (10,2). El costo es unitario por producto, compartido por tallas y colores. No se crean costos para productos sin captura. La nueva tabla singleton `FinancialSettings` almacena `lowMarginThreshold` (0–100, dos decimales, inicialmente 30), `version` y `updatedAt`; tiene RLS habilitado y forzado y acceso SQL exclusivo del backend.

- Utilidad unitaria = precio de venta menos costo interno directo.
- Margen = utilidad / precio de venta × 100.
- Sin costo: no se calcula utilidad ni porcentaje. Costo cero explícito es válido.
- Precio cero: porcentaje indefinido; utilidad calculable si hay costo.
- Pérdida: utilidad negativa, incluso con precio cero. Margen bajo: porcentaje no negativo inferior al umbral global. Igual al umbral es adecuado.
- Los cálculos usan Decimal; clasificación antes del redondeo y presentación a dos decimales.
- Promedio simple de porcentajes por producto con costo y precio mayor a cero. Sin elegibles: `null` / «Sin datos».

KPIs: total, promedio y número de elegibles, margen bajo, pérdida y sin costo. Incluyen todos los productos del filtro, no solamente la página. La lectura usa una transacción RepeatableRead y selecciona solo campos financieros necesarios. La implementación agrega en memoria los productos filtrados; para catálogos de gran volumen deberá sustituirse por agregación SQL manteniendo el contrato.

Filtros por nombre, categoría y estado; activos por defecto. Páginas de 50, orden estable nombre/id. Se pueden editar archivados al seleccionarlos. Importes en MXN. No incluye ventas históricas, ponderación por stock, impuestos, comisiones ni utilidad neta.

## Contratos

Prefijo Edge: `/functions/v1/api/v1/admin`. Todos los endpoints requieren ADMIN.

| Método y ruta                  | Entrada y resultado                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| GET `/finances/dashboard`      | `q`, `category` (UUID), `state=active                                                                                           | archived | all`, `page`. Devuelve `{items,total,settings,kpis}`. Cada fila contiene id, nombre, versión, estado archivado, precios, `amount`, `percent`, `status`. |
| PATCH `/finances/products/:id` | `{version,salePrice,costPrice}`. Actualiza ambos importes atómicamente e incrementa Product.version; devuelve fila recalculada. |
| GET `/finances/settings`       | Devuelve `{lowMarginThreshold,version}`.                                                                                        |
| PUT `/finances/settings`       | `{version,lowMarginThreshold}`. Actualiza el umbral e incrementa su versión.                                                    |

Importes y porcentajes nuevos se serializan como cadenas decimales; campos no calculables son null. `status`: `missing`, `negative`, `undefined`, `low`, `healthy`. Los costos/precios no admiten negativos ni más de dos decimales. Conflictos devuelven 409, producto ausente 404, entradas inválidas 400.

Los endpoints anteriores GET/PUT `/finances` se conservan. GET mantiene su arreglo y margen numérico, ahora calculado con Decimal. PUT sigue aceptando `{productId,costPrice}` sin versión por compatibilidad y ahora incrementa Product.version. Ese contrato antiguo conserva su semántica de última escritura; el nuevo panel exige versión.

La captura conjunta ocurre en Finanzas; el catálogo mantiene su editor de precio. Al guardar se recargan los indicadores. Los borradores se mantienen ante errores y requieren confirmación para descartarse. Los indicadores muestran valores persistidos, no previsualizaciones de borradores.

## Migración y despliegue

1. Aplicar `202611200001_financial_settings` con `npm run db:deploy` y generar cliente con `npm run db:generate`.
2. Publicar Edge Functions compatibles y después Next.js. La migración no altera precios/costos existentes; no requiere nuevas credenciales en Next.js.
3. En staging verificar ADMIN, OPERATOR, usuario anónimo y perfil desactivado; guardar importes, provocar conflicto y actualizar umbral.
4. Vigilar 401/403/409/5xx sin registrar costos, tokens ni datos sensibles. Ante fallo del frontend se puede volver a la versión anterior conservando la migración aditiva y API compatible; no eliminar la tabla mientras la API nueva est? activa.

## Verificación

`tests/finances.test.ts`: precisión decimal, clasificación, ceros, ausencias, validación y permisos. `tests/finances.browser.spec.ts`: navegación protegida, guardado conjunto, umbral persistente y borradores. `tests/integration.ts`: transacciones, conflictos, agregados, compatibilidad y RLS real. El fixture de navegador simula la API; no sustituye integración PostgreSQL.

Comandos: `npm run lint`, `npm run check-types`, `npm run test:unit`, `npm run db:validate`, `npm run check:edge`, `npm run test:integration`, `npm run test:browser`, `npm run build`. Integración necesita PostgreSQL local en 127.0.0.1:55439 o TEST_DATABASE_URL local; crea y elimina una base desechable. No aplicar migraciones de pruebas a producción.
