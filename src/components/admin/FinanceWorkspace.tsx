"use client";
import { useCategories } from "./useCategories";
import { AdminLoading } from "./AdminFeedback";
import AdminButton from "./AdminButton";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  saveFinancialPrices,
  saveFinancialSettings,
} from "@/modules/inventory/application/actions";
import type {
  FinancialDashboard,
  FinancialRow,
} from "../../../supabase/functions/_shared/financial-contracts";
const labels = {
  missing: "Sin costo",
  negative: "Pérdida",
  undefined: "Sin porcentaje (precio cero)",
  low: "Margen bajo",
  healthy: "Margen adecuado",
};
const currency = (value: string | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(Number(value));
export default function FinanceWorkspace() {
  const [data, setData] = useState<FinancialDashboard | null>(null);
  const { categories, categoriesError, retryCategories } = useCategories();
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    state: "active",
    page: 1,
  });
  const [drafts, setDrafts] = useState<
    Record<string, { salePrice: string; costPrice: string; version: number }>
  >({});
  const thresholdVersion = useRef(0);
  const [threshold, setThreshold] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const dirty = Object.keys(drafts).length > 0 || threshold !== null;
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const navigate = (e: MouseEvent) => {
      if (
        (e.target as Element).closest("a[href]") &&
        !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const submit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (
        !form.closest("[data-finance-workspace]") &&
        !window.confirm("Hay cambios sin guardar. \u00bfDescartarlos?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    document.addEventListener("submit", submit, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
      document.removeEventListener("submit", submit, true);
    };
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { data: auth } = await supabaseBrowser().auth.getSession();
        if (!auth.session) throw new ApiError(401, "Inicia sesión de nuevo");
        const query = new URLSearchParams({
          ...filters,
          page: String(filters.page),
        });
        const next = await api<FinancialDashboard>(
          "/admin/finances/dashboard?" + query,
          { signal: controller.signal },
          auth.session.access_token
        );
        if (!controller.signal.aborted) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setData(null);
          setDrafts({});
          setThreshold(null);
          window.location.replace(
            e.status === 401 ? "/401" : "/140210/sin-acceso"
          );
        }
        setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, revision]);
  function discard() {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?"))
      return false;
    setDrafts({});
    setThreshold(null);
    return true;
  }
  function changeFilters(next: typeof filters) {
    if (!discard()) return;
    setLoading(true);
    setMessage("");
    setFilters(next);
  }
  function edit(
    row: FinancialRow,
    field: "salePrice" | "costPrice",
    value: string
  ) {
    setDrafts((old) => ({
      ...old,
      [row.id]: {
        ...(old[row.id] ?? {
          salePrice: row.salePrice,
          costPrice: row.costPrice ?? "",
          version: row.version,
        }),
        [field]: value,
      },
    }));
  }
  function save(row: FinancialRow) {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    startTransition(async () => {
      setError("");
      setMessage("");
      try {
        const result = await saveFinancialPrices(row.id, draft);
        if (!result.ok) {
          setError(result.message);
          if ([401, 403].includes(result.status))
            window.location.replace(
              result.status === 401 ? "/401" : "/140210/sin-acceso"
            );
          return;
        }
        setDrafts((old) => {
          const next = { ...old };
          delete next[row.id];
          return next;
        });
        setMessage("Importes guardados. Actualizando indicadores…");
        setLoading(true);
        setRevision((v) => v + 1);
      } catch {
        setError("No se pudo guardar. Intenta de nuevo.");
      }
    });
  }
  return (
    <main
      data-finance-workspace
      className="admin-form mx-auto w-full max-w-7xl space-y-6 p-6 md:p-10"
    >
      <Link prefetch={false} href="/140210" className="underline">
        Administración
      </Link>
      <h1 className="font-display text-4xl">Finanzas y márgenes</h1>
      <p>
        Rentabilidad bruta por unidad del catálogo actual, en MXN. No incluye
        impuestos, comisiones ni ventas históricas.
      </p>
      <p role="alert">{error}</p>
      {categoriesError && (
        <div role="alert">
          No se pudieron cargar las categorías.{" "}
          <AdminButton type="button" onClick={retryCategories}>
            Reintentar categorías
          </AdminButton>
        </div>
      )}
      <p role="status">{message}</p>
      <AdminButton
        type="button"
        disabled={pending || loading}
        className="underline"
        onClick={() => {
          if (discard()) {
            setLoading(true);
            setRevision((v) => v + 1);
          }
        }}
      >
        Recargar datos
      </AdminButton>
      <fieldset disabled={pending || loading} className="flex flex-wrap gap-4">
        <legend>Filtrar productos</legend>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            changeFilters({ ...filters, q: String(f.get("q")), page: 1 });
          }}
        >
          <label>
            Buscar por nombre
            <input name="q" defaultValue={filters.q} maxLength={200} />
          </label>
          <AdminButton>Buscar</AdminButton>
        </form>
        <label>
          Categoría
          <select
            value={filters.category}
            onChange={(e) =>
              changeFilters({ ...filters, category: e.target.value, page: 1 })
            }
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            value={filters.state}
            onChange={(e) =>
              changeFilters({ ...filters, state: e.target.value, page: 1 })
            }
          >
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </fieldset>
      {loading && (
        <AdminLoading
          initial={!data}
          label={data ? "Actualizando indicadores…" : "Cargando indicadores…"}
        />
      )}
      {data && (
        <>
          <section
            aria-label="Indicadores financieros"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            {[
              ["Productos", data.total],
              [
                "Margen promedio",
                data.kpis.averageMargin === null
                  ? "Sin datos"
                  : data.kpis.averageMargin + "%",
              ],
              ["Margen bajo", data.kpis.low],
              ["Con pérdida", data.kpis.negative],
              ["Sin costo", data.kpis.missing],
            ].map(([label, value]) => (
              <div key={label} className="border p-4">
                <p>{label}</p>
                <strong className="text-2xl">{value}</strong>
              </div>
            ))}
          </section>
          <p>
            Promedio simple de {data.kpis.eligible} productos con costo y precio
            mayor a cero. Los indicadores incluyen todos los resultados del
            filtro, no solo esta página.
          </p>
          <form
            className="flex flex-wrap items-end gap-4 border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (threshold === null) return;
              setSavingId("threshold");
              startTransition(async () => {
                setError("");
                try {
                  const result = await saveFinancialSettings({
                    version: thresholdVersion.current,
                    lowMarginThreshold: threshold,
                  });
                  if (!result.ok) {
                    setError(result.message);
                    if ([401, 403].includes(result.status))
                      window.location.replace(
                        result.status === 401 ? "/401" : "/140210/sin-acceso"
                      );
                    return;
                  }
                  setThreshold(null);
                  setMessage("Umbral guardado.");
                  setLoading(true);
                  setRevision((v) => v + 1);
                } catch {
                  setError("No se pudo guardar el umbral. Intenta de nuevo.");
                }
              });
            }}
          >
            <label>
              Umbral global de margen bajo (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={threshold ?? data.settings.lowMarginThreshold}
                disabled={pending || loading}
                onChange={(e) => {
                  if (threshold === null)
                    thresholdVersion.current = data.settings.version;
                  setThreshold(e.target.value);
                }}
              />
            </label>
            <AdminButton
              pending={pending && savingId === "threshold"}
              disabled={pending || loading || threshold === null}
              className="shop-button"
            >
              Guardar umbral
            </AdminButton>
            <p>Margen inferior al umbral: ámbar. Pérdida: rojo.</p>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="text-left">
                Utilidad unitaria por producto. Los márgenes corresponden a los
                importes guardados.
              </caption>
              <thead>
                <tr>
                  {[
                    "Producto",
                    "Precio de Venta (MXN)",
                    "Costo Interno Directo (MXN)",
                    "Utilidad unitaria",
                    "Margen",
                    "Alerta",
                    "Acciones",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="p-3">
                      {row.name}
                      <small className="block">
                        {row.isArchived ? "Archivado" : "Activo"}
                      </small>
                    </td>
                    <td className="p-3">
                      <input
                        aria-label={"Precio de Venta de " + row.name}
                        form={"finance-" + row.id}
                        type="number"
                        min="0"
                        max="99999999.99"
                        step="0.01"
                        required
                        disabled={pending || loading}
                        value={drafts[row.id]?.salePrice ?? row.salePrice}
                        onChange={(e) => edit(row, "salePrice", e.target.value)}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        aria-label={"Costo Interno Directo de " + row.name}
                        form={"finance-" + row.id}
                        type="number"
                        min="0"
                        max="99999999.99"
                        step="0.01"
                        required
                        placeholder="Sin costo"
                        disabled={pending || loading}
                        value={drafts[row.id]?.costPrice ?? row.costPrice ?? ""}
                        onChange={(e) => edit(row, "costPrice", e.target.value)}
                      />
                    </td>
                    <td className="p-3">{currency(row.amount)}</td>
                    <td className="p-3">
                      {row.percent === null ? "—" : row.percent + "%"}
                    </td>
                    <td
                      className={
                        row.status === "negative"
                          ? "p-3 font-semibold text-red-700"
                          : row.status === "low"
                            ? "p-3 font-semibold text-amber-800"
                            : "p-3"
                      }
                    >
                      {labels[row.status]}
                    </td>
                    <td className="p-3">
                      <form
                        id={"finance-" + row.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          save(row);
                        }}
                      >
                        <AdminButton
                          pending={pending && savingId === row.id}
                          disabled={pending || loading || !drafts[row.id]}
                          className="shop-button"
                        >
                          Guardar
                        </AdminButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.total && <p>No hay productos para estos filtros.</p>}
          <nav aria-label="Paginación financiera" className="flex gap-5">
            <AdminButton
              disabled={pending || loading || filters.page === 1}
              onClick={() =>
                changeFilters({ ...filters, page: filters.page - 1 })
              }
            >
              Anterior
            </AdminButton>
            <span>
              Página {filters.page} de {Math.max(1, Math.ceil(data.total / 50))}
            </span>
            <AdminButton
              disabled={pending || loading || filters.page * 50 >= data.total}
              onClick={() =>
                changeFilters({ ...filters, page: filters.page + 1 })
              }
            >
              Siguiente
            </AdminButton>
          </nav>
        </>
      )}
    </main>
  );
}
