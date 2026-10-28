"use client";
import { useRouter } from "next/navigation";
import { statusLabel } from "@/lib/status-label";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type {
  CatalogProduct,
  AdminOrder,
} from "../../../supabase/functions/_shared/contracts";
import ProductEditor from "./ProductEditor";
type Role = { id: string; role: "ADMIN" | "STAFF"; active: boolean };
type Finance = {
  id: string;
  name: string;
  salePrice: string;
  costPrice: string | null;
  margin: { amount: number; percent: number | null } | null;
};
type Subscription = {
  id: string;
  email: string;
  status: string;
  variant: { size: string; color: string; product: { name: string } };
  notifications: {
    status: string;
    attempts: number;
    lastError: string | null;
  }[];
};
const sections = [
  "productos",
  "inventario",
  "ordenes",
  "restock",
  "finanzas",
  "roles",
] as const;
export default function AdminConsole() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<string>("productos");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [finances, setFinances] = useState<Finance[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    []
  );
  const [editing, setEditing] = useState<CatalogProduct | null | undefined>(
    undefined
  );
  const call = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const { data } = await supabaseBrowser().auth.getSession();
      if (!data.session) throw new Error("Inicia sesión de nuevo");
      return api<T>(path, options, data.session.access_token);
    },
    []
  );
  const load = useCallback(async () => {
    try {
      const me = await call<Role>("/admin/me");
      setRole(me);
      setError("");
      if ((tab === "finanzas" || tab === "roles") && me.role !== "ADMIN")
        throw new Error("Esta sección requiere ADMIN");
      if (tab === "productos" || tab === "inventario") {
        const result = await call<{ items: CatalogProduct[] }>(
          "/admin/products?page=" + page
        );
        setProducts(result.items);
        setCategories(await api("/categories"));
      }
      if (tab === "ordenes")
        setOrders(await call("/admin/orders?page=" + page));
      if (tab === "restock") setSubs(await call("/admin/restock?page=" + page));
      if (tab === "finanzas")
        setFinances(await call("/admin/finances?page=" + page));
      if (tab === "roles") setRoles(await call("/admin/roles"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [call, tab, page]);
  // This effect fetches external data; its updates occur after network promises settle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Updates follow the API request.
    void load();
  }, [load]);
  async function act(path: string, method: string, value: unknown) {
    setBusy(true);
    setError("");
    try {
      await call(path, { method, body: JSON.stringify(value) });
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-form mx-auto w-full max-w-7xl space-y-7 p-6 md:p-10">
      <div className="flex flex-wrap justify-between gap-4">
        <h1 className="font-display text-4xl">Administración</h1>
        <button
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            router.replace("/admin/login");
          }}
        >
          Cerrar sesión
        </button>
      </div>
      <nav className="flex flex-wrap gap-3" aria-label="Administración">
        {sections
          .filter(
            (s) => role?.role === "ADMIN" || !["finanzas", "roles"].includes(s)
          )
          .map((s) => (
            <button
              aria-current={tab === s ? "page" : undefined}
              className={tab === s ? "shop-button" : "border px-4 py-3"}
              key={s}
              onClick={() => {
                setTab(s);
                setPage(1);
                setEditing(undefined);
              }}
            >
              {s}
            </button>
          ))}
      </nav>
      <p role="alert">{error}</p>
      {busy && <p role="status">Procesando…</p>}
      {tab === "productos" && (
        <>
          <button className="shop-button" onClick={() => setEditing(null)}>
            Nuevo producto
          </button>
          {editing !== undefined && (
            <ProductEditor
              key={editing?.id || "new"}
              product={editing}
              categories={categories}
              call={call}
              onClose={() => setEditing(undefined)}
              onSaved={async () => {
                setEditing(undefined);
                await load();
              }}
            />
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <p className="text-sm">
                        {p.categories.map((c) => c.category.name).join(", ")}
                      </p>
                    </td>
                    <td>$ {p.salePrice}</td>
                    <td>{p.isArchived ? "Archivado" : "Activo"}</td>
                    <td>
                      <button
                        className="underline"
                        onClick={() => setEditing(p)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "inventario" &&
        products.map((p) => (
          <section className="space-y-4 border p-4" key={p.id}>
            <h2 className="text-xl">{p.name}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                await act("/admin/stock", "PATCH", {
                  changes: p.variants.map((v) => ({
                    id: v.id,
                    version: v.version,
                    stock: Number(form.get(v.id)),
                  })),
                });
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Talla / color</th>
                      {[...new Set(p.variants.map((v) => v.color))].map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set(p.variants.map((v) => v.size))].map((size) => (
                      <tr key={size}>
                        <th>{size}</th>
                        {[...new Set(p.variants.map((v) => v.color))].map(
                          (color) => {
                            const v = p.variants.find(
                              (v) => v.size === size && v.color === color
                            );
                            return (
                              <td key={color}>
                                {v ? (
                                  <>
                                    <input
                                      key={v.version}
                                      aria-label={size + " " + color}
                                      type="number"
                                      min="0"
                                      max="100000"
                                      name={v.id}
                                      defaultValue={v.stock}
                                      required
                                    />
                                    <small>
                                      {v.sku}{" "}
                                      {v.isArchived ? "(archivada)" : ""}
                                    </small>
                                    <button
                                      type="button"
                                      className="ml-2 underline"
                                      disabled={busy}
                                      onClick={() =>
                                        act(
                                          "/admin/variants/" + v.id,
                                          "PATCH",
                                          {
                                            version: v.version,
                                            isArchived: !v.isArchived,
                                          }
                                        )
                                      }
                                    >
                                      {v.isArchived ? "Activar" : "Archivar"}
                                    </button>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          }
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {p.variants.length > 0 && (
                <button disabled={busy} className="shop-button mt-3">
                  Guardar existencias
                </button>
              )}
            </form>
            <details>
              <summary>Agregar variante</summary>
              <form
                className="mt-4 grid gap-3 md:grid-cols-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  if (
                    await act("/admin/variants", "POST", {
                      productId: p.id,
                      size: data.get("size"),
                      color: data.get("color"),
                      colorHex: data.get("colorHex"),
                      sku: data.get("sku"),
                    })
                  )
                    form.reset();
                }}
              >
                <label>
                  Talla
                  <input name="size" required />
                </label>
                <label>
                  Color
                  <input name="color" required />
                </label>
                <label>
                  Color visual
                  <input name="colorHex" type="color" defaultValue="#222222" />
                </label>
                <label>
                  SKU
                  <input name="sku" required />
                </label>
                <button disabled={busy} className="shop-button">
                  Agregar
                </button>
              </form>
            </details>
          </section>
        ))}
      {tab === "ordenes" &&
        orders.map((o) => (
          <section className="space-y-3 border p-5" key={o.id}>
            <h2 className="text-xl">
              #{o.orderNumber} · {statusLabel(o.status)}
            </h2>
            <p>
              {o.clientName} · {o.clientPhone}
            </p>
            <ul>
              {o.items.map((i, n) => (
                <li key={n}>
                  {i.quantity} × {i.productName} / {i.size} / {i.color} · ${" "}
                  {i.price}
                </li>
              ))}
            </ul>
            <p>
              Total $ {o.totalAmount} MXN · Vence{" "}
              {new Date(o.expiresAt).toLocaleString("es-MX")}
            </p>
            <div className="flex gap-3">
              {(o.status === "PENDING_PAYMENT"
                ? ["CONFIRMED", "CANCELLED"]
                : o.status === "CONFIRMED"
                  ? ["SHIPPED"]
                  : []
              ).map((status) => (
                <button
                  disabled={busy}
                  key={status}
                  className="shop-button"
                  onClick={() =>
                    act("/admin/orders/" + o.id, "PATCH", { status })
                  }
                >
                  {status === "CONFIRMED"
                    ? "Confirmar pago"
                    : status === "SHIPPED"
                      ? "Marcar enviado"
                      : "Cancelar"}
                </button>
              ))}
            </div>
          </section>
        ))}
      {tab === "restock" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {["Producto", "Variante", "Correo", "Estado", "Envíos"].map(
                  (s) => (
                    <th key={s}>{s}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{s.variant.product.name}</td>
                  <td>
                    {s.variant.size} / {s.variant.color}
                  </td>
                  <td>{s.email}</td>
                  <td>{statusLabel(s.status)}</td>
                  <td>
                    {s.notifications.map((n, i) => (
                      <p key={i}>
                        {statusLabel(n.status)} · {n.attempts} intentos{" "}
                        {n.lastError}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "finanzas" && (
        <div className="space-y-4">
          <p>
            Utilidad bruta = precio − costo. Los productos sin costo no tienen
            margen calculado.
          </p>
          {finances.map((f) => (
            <form
              className="grid items-end gap-3 border p-4 md:grid-cols-4"
              key={f.id}
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                await act("/admin/finances", "PUT", {
                  productId: f.id,
                  costPrice: data.get("cost"),
                });
              }}
            >
              <div>
                <h2>{f.name}</h2>
                <p>Venta $ {f.salePrice}</p>
              </div>
              <label>
                Costo MXN
                <input
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={f.costPrice || ""}
                  required
                />
              </label>
              <p
                className={
                  f.margin && f.margin.amount < 0 ? "text-red-700" : ""
                }
              >
                Utilidad:{" "}
                {f.margin
                  ? "$ " +
                    f.margin.amount.toFixed(2) +
                    " / " +
                    (f.margin.percent === null
                      ? "Sin porcentaje"
                      : f.margin.percent.toFixed(2) + "%")
                  : "Sin costo"}
              </p>
              <button disabled={busy} className="shop-button">
                Guardar costo
              </button>
            </form>
          ))}
        </div>
      )}
      {tab === "roles" && (
        <>
          <p>
            El usuario debe existir en Supabase Auth. No puedes modificar tu
            propio rol.
          </p>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await act("/admin/roles", "PUT", {
                id: f.get("id"),
                role: f.get("role"),
                active: f.get("active") === "on",
              });
            }}
          >
            <label>
              UUID del usuario
              <input name="id" required />
            </label>
            <label>
              Rol
              <select name="role">
                <option>STAFF</option>
                <option>ADMIN</option>
              </select>
            </label>
            <label>
              <input name="active" type="checkbox" defaultChecked /> Activo
            </label>
            <button disabled={busy} className="shop-button">
              Guardar permisos
            </button>
          </form>
          <ul>
            {roles.map((r) => (
              <li className="border-b py-3" key={r.id}>
                {r.id} · {r.role} · {r.active ? "Activo" : "Desactivado"}
              </li>
            ))}
          </ul>
        </>
      )}
      {tab !== "roles" && (
        <div className="flex gap-5">
          <button
            disabled={page === 1 || busy}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span>Página {page}</span>
          <button disabled={busy} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      )}
    </main>
  );
}
