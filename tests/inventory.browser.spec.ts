import { test, expect, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:55440";
test.setTimeout(60000);
async function login(page: Page, role = "admin") {
  await page.goto("/140210/login");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`inventory-${role}@example.test`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/140210$/);
}
test.beforeEach(async ({ request }) => {
  await request.post(fixture + "/test/inventory/reset");
});

test("multiple product matrices save only changed cells through a server action", async ({
  page,
  request,
}) => {
  await login(page, "operator");
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await page.getByLabel("Prenda 1: M / Negro").fill("8");
  await page.getByLabel("Prenda 2: M / Negro").fill("0");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByText("Existencias guardadas", { exact: true })
  ).toBeVisible();
  const state = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  expect(state.stockRequests).toHaveLength(1);
  expect(state.stockRequests[0].changes).toHaveLength(2);
  expect(
    state.inventory.map(
      (p: { variants: { stock: number }[] }) => p.variants[0].stock
    )
  ).toEqual([8, 0]);
  await page.getByLabel("Prenda 1: M / Negro").fill("9");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.getByText("0 / 100 celdas modificadas")).toBeVisible();
  const next = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  expect(next.stockRequests[1].changes).toHaveLength(1);
  expect(next.stockRequests[1].changes[0].version).toBe(1);
});

test("navigation asks to resolve drafts and conflicts preserve values", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/140210/inventario");
  await page.getByLabel("Prenda 1: M / Negro").fill("");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByText("Las existencias deben ser enteros entre 0 y 100000")
  ).toBeVisible();
  await page.getByLabel("Prenda 1: M / Negro").fill("7");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByLabel("Prenda 1: M / Negro")).toHaveValue("7");
  await page.getByLabel("Prenda 2: M / Negro").fill("9");
  await request.post(fixture + "/test/inventory/conflict");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recargar datos" })
  ).toBeVisible();
  await expect(page.getByLabel("Prenda 1: M / Negro")).toHaveValue("7");
  const state = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  expect(state.inventory[0].variants[0].stock).toBe(3);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Recargar datos" }).click();
  await expect(page.getByLabel("Prenda 1: M / Negro")).toHaveValue("3");
  await page.getByLabel("Prenda 1: M / Negro").fill("6");
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page.getByRole("button", { name: "Descartar y continuar" }).click();
  await expect(page).toHaveURL(/\/140210\/productos$/);
});

test("catalog creates products and variants, edits and restores without losing stock", async ({
  page,
}) => {
  await login(page);
  await page.goto("/140210/productos");
  await page
    .getByRole("button", { name: "Nuevo producto", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Prenda nueva");
  await page.getByLabel("Dirección del producto").fill("prenda-nueva");
  await page.getByLabel("Precio de venta MXN").fill("250");
  await page.getByRole("checkbox", { name: "Camisetas", exact: true }).check();
  await page
    .getByRole("button", { name: "Guardar y cerrar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Variantes de Prenda nueva", exact: true })
    .click();
  await page.getByLabel("Talla", { exact: true }).fill("L");
  await page.getByLabel("Color", { exact: true }).fill("Azul");
  await page.getByLabel("SKU", { exact: true }).fill("NUEVA-L-AZUL");
  await page.getByRole("button", { name: "Agregar variante" }).click();
  await expect(
    page.getByRole("button", { name: "Editar NUEVA-L-AZUL", exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar NUEVA-L-AZUL", exact: true })
    .click();
  await page.getByLabel("Talla", { exact: true }).fill("XL");
  await page
    .getByRole("button", { name: "Guardar variante", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("XL / Azul", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar editor" }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Archivar Prenda 1", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("archived");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Restaurar Prenda 1", exact: true })
    .click();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await expect(page.getByLabel("Prenda 1: M / Negro")).toHaveValue("3");
});

test("operator cannot open product administration and mobile matrices remain usable", async ({
  page,
}) => {
  await login(page, "operator");
  await page.goto("/140210/productos");
  await expect(page).toHaveURL(/\/140210\/sin-acceso$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/140210/inventario");
  await expect(page.getByLabel("Prenda 1: M / Negro")).toBeVisible();
  await page.getByLabel("Prenda 1: M / Negro").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Prenda 2: M / Negro")).toBeFocused();
});
