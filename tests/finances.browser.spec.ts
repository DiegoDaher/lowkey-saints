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
test("ADMIN saves prices and global threshold; unsaved edits are protected", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Finanzas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Finanzas y márgenes" })
  ).toBeVisible();
  await expect(page.getByText("Sin costo", { exact: true })).toHaveCount(3);
  const row = page.getByRole("row").filter({ hasText: "Prenda 1" });
  await row
    .getByLabel("Costo Interno Directo de Prenda 1", { exact: true })
    .fill("80");
  await row.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(row.getByText("20.00%", { exact: true })).toBeVisible();
  await expect(row.getByText("Margen bajo", { exact: true })).toBeVisible();
  await page.getByLabel("Umbral global de margen bajo (%)").fill("20");
  await page.getByRole("button", { name: "Guardar umbral" }).click();
  await expect(row.getByText("Margen adecuado", { exact: true })).toBeVisible();
  await row
    .getByLabel("Costo Interno Directo de Prenda 1", { exact: true })
    .fill("120");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("link", { name: "Administración", exact: true }).click();
  await expect(page).toHaveURL(/finanzas$/);
  await row.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(row.getByText("Pérdida", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Umbral global de margen bajo (%)")).toHaveValue(
    "20.00"
  );
});
test("financial pages protect anonymous and OPERATOR access", async ({
  page,
}) => {
  expect((await page.goto("/admin/finanzas"))?.status()).toBe(404);
  expect((await page.goto("/140210/finanzas"))?.status()).toBe(401);
  await login(page, "operator");
  await expect(
    page.getByRole("link", { name: "Finanzas", exact: true })
  ).toHaveCount(0);
  await page.goto("/140210/finanzas");
  await expect(page).toHaveURL(/sin-acceso$/);
});
