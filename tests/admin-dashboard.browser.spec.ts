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
test("restock filters, counts and retries failed notices (LOG-06)", async ({
  page,
}, info) => {
  const failedNotice = {
    id: "00000000-0000-4000-8000-0000000000a1",
    generation: 0,
    status: "FAILED",
    attempts: 5,
    lastError: "Proveedor respondió HTTP 503",
    availableAt: "2026-11-26T18:00:00Z",
    sentAt: null,
    firstAttemptAt: "2026-11-26T17:00:00Z",
    createdAt: "2026-11-26T16:00:00Z",
    retry: "ready",
  };
  const row = {
    id: "00000000-0000-4000-8000-0000000000b1",
    email: "ana@example.test",
    status: "ACTIVE",
    generation: 0,
    createdAt: "2026-11-20T16:00:00Z",
    variant: {
      size: "M",
      color: "Negro",
      stock: 3,
      product: { name: "Hoodie Saints" },
    },
    notifications: [failedNotice],
  };
  const queries: URLSearchParams[] = [];
  const retries: unknown[] = [];
  let retried = false;
  await page.route("**/functions/v1/api/v1/admin/restock?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    const items =
      params.get("q") === "nadie"
        ? []
        : [
            {
              ...row,
              notifications: [
                retried
                  ? { ...failedNotice, status: "PENDING", retry: null }
                  : failedNotice,
              ],
            },
          ];
    return route.fulfill({
      json: {
        items,
        total: items.length,
        page: 1,
        pages: items.length ? 1 : 0,
        counts: {
          FAILED: retried ? 0 : 1,
          PENDING: retried ? 1 : 0,
          SENT: 4,
          CANCELLED: 0,
          PROCESSING: 0,
        },
      },
    });
  });
  await page.route("**/functions/v1/api/v1/admin/restock/retry", (route) => {
    retries.push(route.request().postDataJSON());
    retried = true;
    return route.fulfill({ json: { ok: true, forced: false } });
  });
  await login(page);
  await page.goto("/140210/restock");
  const main = page.getByRole("main");
  await expect(
    main.getByText("Proveedor respondió HTTP 503 · 5 intentos")
  ).toBeVisible();
  await expect(main.getByText("Página 1 de 1 · 1 suscripción")).toBeVisible();
  const chip = main.getByRole("button", { name: "Requieren revisión · 1" });
  await chip.click();
  await expect(
    main.getByRole("button", { name: /Requieren revisión/ })
  ).toHaveAttribute("aria-pressed", "true");
  expect(queries.at(-1)?.get("delivery")).toBe("FAILED");
  await page.screenshot({
    path: info.outputPath("restock.png"),
    fullPage: true,
  });
  await main
    .getByRole("button", { name: "Reintentar aviso para ana@example.test" })
    .click();
  await expect(main.getByRole("status")).toContainText(
    "Aviso para ana@example.test en cola de nuevo."
  );
  expect(retries).toEqual([{ notificationId: failedNotice.id, force: false }]);
  await expect(
    main.getByRole("table").getByText("En cola", { exact: true })
  ).toBeVisible();
  await main.getByLabel("Buscar por correo o producto").fill("nadie");
  await main.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    main.getByText("No hay avisos con estos filtros.")
  ).toBeVisible();
  await main.getByRole("button", { name: "Limpiar" }).click();
  await expect(main.getByText("ana@example.test")).toBeVisible();
  expect(queries.at(-1)?.toString()).toBe("page=1");
});
