import { test, expect, type Page } from "@playwright/test";
test.setTimeout(60000);
async function login(page: Page, email = "inventory-admin@example.test") {
  await page.goto("/140210/login");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/140210$/);
}
test("desktop dashboard isolates storefront and does not fetch operational lists", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/functions/v1/api/v1/")) calls.push(r.url());
  });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Administración", exact: true })
  ).toBeVisible();
  await expect(page.locator(".store-header, .store-footer")).toHaveCount(0);
  await expect(page.locator(".admin-access-card")).toHaveCount(6);
  expect(
    calls.filter((url) =>
      /\/admin\/(products|orders|users|restock|finances)/.test(url)
    )
  ).toEqual([]);
  await expect(
    page
      .getByRole("navigation", { name: "Administración", exact: true })
      .getByRole("link", { name: "Inicio" })
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({
    path: info.outputPath("dashboard-desktop.png"),
    fullPage: true,
  });
});
test("mobile navigation supports keyboard and operator permissions", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "inventory-operator@example.test");
  await page.getByRole("button", { name: "Menú", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Finanzas", exact: true })
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("link", { name: "Inventario", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Menú", exact: true })
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("dashboard-mobile.png"),
    fullPage: true,
  });
});
test("inventory refresh preserves rows and does not refetch categories", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let categories = 0;
  await page.route("**/functions/v1/api/v1/categories", async (route) => {
    categories++;
    await route.continue();
  });
  await login(page);
  await page
    .getByRole("navigation", { name: "Administración", exact: true })
    .getByRole("link", { name: "Inventario", exact: true })
    .click();
  await expect(page.getByLabel("Prenda 1: M / Negro")).toBeVisible();
  const initialCategories = categories;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/functions/v1/api/v1/admin/products?**",
    async (route) => {
      await pending;
      await route.continue();
    }
  );
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    page.getByText("Actualizando catálogo…", { exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Prenda 1: M / Negro")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aplicar filtros" })
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Aplicar filtros" })
  ).toBeEnabled();
  expect(categories).toBe(initialCategories);
});
test("field focus changes its own border without an offset outline", async ({
  page,
}) => {
  await page.goto("/140210/login");
  const input = page.getByLabel("Correo", { exact: true });
  const before = await input.boundingBox();
  await input.focus();
  await expect(input).toHaveCSS("outline-style", "none");
  await expect(input).toHaveCSS("border-color", "rgb(128, 92, 39)");
  expect(await input.boundingBox()).toEqual(before);
  await page.goto("/bolsa");
  await expect(page.locator(".store-footer")).toBeVisible();
});
test("restock supports failure, retry and an empty result", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/functions/v1/api/v1/admin/restock?**", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({
          status: 503,
          json: { error: "Servicio temporalmente no disponible" },
        })
      : route.fulfill({ json: [] });
  });
  await login(page);
  await page.goto("/140210/restock");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Servicio temporalmente no disponible"
  );
  await page.getByRole("button", { name: "Reintentar carga" }).click();
  await expect(
    page.getByText("No hay suscripciones en esta página.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
});
