import { test, expect, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:55440";
test.setTimeout(60000);
async function catalog(page: Page) {
  await page.goto("/140210/login");
  await page
    .getByLabel("Correo", { exact: true })
    .fill("inventory-admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/140210$/);
  await page.goto("/140210/productos");
  await expect(
    page.getByRole("button", { name: "Nuevo producto", exact: true })
  ).toBeEnabled();
}
test.beforeEach(async ({ request }) => {
  await request.post(fixture + "/test/inventory/reset");
});
test("access routes restore storefront chrome", async ({ page }) => {
  for (const url of ["/140210/login", "/140210/recuperar"]) {
    await page.goto(url);
    await expect(page.locator(".store-header")).toBeVisible();
    await expect(page.locator(".store-footer")).toBeVisible();
  }
  await catalog(page);
  await expect(page.locator(".store-header")).toHaveCount(0);
});
test("new product stays open, saves next version and preserves sections", async ({
  page,
  request,
}) => {
  await catalog(page);
  await page
    .getByRole("button", { name: "Nuevo producto", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await modal.getByLabel("Nombre", { exact: true }).fill("Prenda modal");
  await modal.getByLabel("Dirección del producto").fill("prenda-modal");
  await modal.getByLabel("Precio de venta MXN").fill("250");
  await modal.getByRole("checkbox", { name: "Camisetas", exact: true }).check();
  await modal
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    modal.getByText("Prenda guardada. Puedes seguir completándola.")
  ).toBeVisible();
  await modal
    .getByRole("tab", { name: "Detalles y medidas", exact: true })
    .click();
  await modal.getByLabel("Materiales", { exact: true }).fill("Algodón");
  await modal
    .getByRole("tab", { name: "Datos esenciales", exact: true })
    .click();
  await expect(modal.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Prenda modal"
  );
  await modal
    .getByRole("tab", { name: "Detalles y medidas", exact: true })
    .click();
  await expect(modal.getByLabel("Materiales", { exact: true })).toHaveValue(
    "Algodón"
  );
  await modal
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    modal.getByText("Prenda guardada. Puedes seguir completándola.")
  ).toBeVisible();
  const state = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  const created = state.inventory.filter(
    (p: { slug: string }) => p.slug === "prenda-modal"
  );
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ version: 1, materials: "Algodón" });
  await modal.getByRole("button", { name: "Cerrar editor" }).click();
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar Prenda modal", exact: true })
  ).toBeVisible();
});
test("keyboard, dirty close and mobile sizing", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await catalog(page);
  const trigger = page.getByRole("button", {
    name: "Editar Prenda 1",
    exact: true,
  });
  await trigger.click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Nombre", { exact: true })).toBeEnabled();
  await modal
    .getByRole("tab", { name: "Datos esenciales", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    modal.getByRole("tab", { name: "Fotografías", exact: true })
  ).toBeFocused();
  await expect(
    modal.getByRole("tab", { name: "Fotografías", exact: true })
  ).toHaveAttribute("aria-selected", "true");
  await modal
    .getByRole("tab", { name: "Datos esenciales", exact: true })
    .click();
  await modal.getByLabel("Nombre", { exact: true }).fill("Pendiente");
  await page.keyboard.press("Escape");
  await expect(
    modal.getByRole("heading", { name: "Hay cambios sin guardar" })
  ).toBeVisible();
  await modal.getByRole("button", { name: "Seguir editando" }).click();
  await expect(modal.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Pendiente"
  );
  const rect = await modal.boundingBox();
  expect(rect?.width).toBeLessThanOrEqual(390);
  expect(rect?.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: info.outputPath("product-modal-mobile.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await modal
    .getByRole("button", { name: "Descartar cambios y cerrar" })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test("validation reveals the section with invalid fields", async ({ page }) => {
  await catalog(page);
  await page
    .getByRole("button", { name: "Editar Prenda 1", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Nombre", { exact: true })).toBeEnabled();
  await modal
    .getByRole("tab", { name: "Detalles y medidas", exact: true })
    .click();
  await modal.getByRole("button", { name: "Agregar talla" }).click();
  await modal
    .getByRole("tab", { name: "Datos esenciales", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    modal.getByRole("tab", { name: /Detalles y medidas/ })
  ).toHaveAttribute("aria-selected", "true");
  await expect(modal.getByText("Revisa los campos indicados.")).toBeVisible();
});
test("look candidates load lazily with images and selected cards survive search", async ({
  page,
  request,
}, info) => {
  await catalog(page);
  let searches = 0;
  await page.route(
    /\/functions\/v1\/api\/v1\/admin\/products\?/,
    async (route) => {
      searches++;
      const response = await route.fetch();
      const data = await response.json();
      data.items = data.items.map((p: Record<string, unknown>) => ({
        ...p,
        images: [
          {
            url: "/images/editorial/alo-coffee.webp",
            alt: "Portada de prueba",
            path: "photo.webp",
          },
        ],
      }));
      await route.fulfill({ json: data });
    }
  );
  await page
    .getByRole("button", { name: "Editar Prenda 1", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Nombre", { exact: true })).toBeEnabled();
  expect(searches).toBe(0);
  await modal
    .getByRole("tab", { name: "Completa el look", exact: true })
    .click();
  await expect(
    modal.getByRole("checkbox", { name: "Complementar con Prenda 2" })
  ).toBeVisible();
  await expect(modal.getByAltText("Portada de prueba")).toBeVisible();
  await modal
    .getByRole("checkbox", { name: "Complementar con Prenda 2" })
    .check();
  await modal.getByLabel("Buscar productos").fill("inexistente");
  await expect(
    modal.getByText("No hay más prendas para esta búsqueda.")
  ).toBeVisible();
  await expect(
    modal.getByRole("checkbox", { name: "Complementar con Prenda 2" })
  ).toBeChecked();
  await page.screenshot({
    path: info.outputPath("product-look-desktop.png"),
    fullPage: true,
  });
  await modal
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    modal.getByText("Prenda guardada. Puedes seguir completándola.")
  ).toBeVisible();
  const state = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  expect(state.inventory[0].complementaryIds).toEqual([state.inventory[1].id]);
});
test("failed detail cannot overwrite product and can retry", async ({
  page,
}) => {
  await catalog(page);
  let fail = true;
  await page.route("**/functions/v1/api/v1/admin/products/*", (route) =>
    fail
      ? route.fulfill({ status: 503, json: { error: "Detalle no disponible" } })
      : route.continue()
  );
  await page
    .getByRole("button", { name: "Editar Prenda 1", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByText("Detalle no disponible")).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "Guardar cambios", exact: true })
  ).toBeDisabled();
  fail = false;
  await modal.getByRole("button", { name: "Reintentar carga" }).click();
  await expect(modal.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Prenda 1"
  );
});

test("variant switching and closure protect unsaved edits", async ({
  page,
}) => {
  await catalog(page);
  const trigger = page.getByRole("button", {
    name: "Variantes de Prenda 1",
    exact: true,
  });
  await trigger.click();
  const modal = page.getByRole("dialog");
  await modal
    .getByRole("button", { name: "Editar SKU-1", exact: true })
    .click();
  await modal.getByLabel("Talla", { exact: true }).fill("XL");
  await modal
    .getByRole("button", { name: "Cancelar edición", exact: true })
    .click();
  await expect(
    modal.getByRole("group", { name: "Cambios sin guardar", exact: true })
  ).toBeVisible();
  await modal
    .getByRole("button", { name: "Seguir editando", exact: true })
    .click();
  await expect(modal.getByLabel("Talla", { exact: true })).toHaveValue("XL");
  await page.keyboard.press("Escape");
  await modal
    .getByRole("button", { name: "Seguir editando", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Guardar variante", exact: true })
    .click();
  await expect(
    modal.getByText("Variante guardada. Puedes continuar con otra.")
  ).toBeVisible();
  await modal.getByRole("button", { name: "Cerrar editor" }).click();
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
