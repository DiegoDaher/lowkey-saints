import { test, expect, type Page } from "@playwright/test";

async function login(
  page: Page,
  email = "operator@example.test",
  password = "test-only-password"
) {
  await page.goto("/admin/login");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
test("SSR protects the panel and operator sees only stock and orders", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
  const nav = page.getByRole("navigation", {
    name: "Administración",
    exact: true,
  });
  await expect(
    nav.getByRole("link", { name: "inventario", exact: true })
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "productos", exact: true })
  ).toHaveCount(0);
  await expect(
    nav.getByRole("button", { name: "finanzas", exact: true })
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/ordenes");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
test("ADMIN can navigate to catalog", async ({ page }) => {
  await login(page, "admin@example.test");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
  const nav = page.getByRole("navigation", {
    name: "Administración",
    exact: true,
  });
  await expect(
    nav.getByRole("link", { name: "productos", exact: true })
  ).toBeVisible();
  await expect(
    nav.getByRole("button", { name: "finanzas", exact: true })
  ).toBeVisible();
});
test("proxy refreshes an expired session cookie before rendering", async ({
  page,
  context,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
  const cookie = (await context.cookies()).find((value) =>
    value.name.endsWith("-auth-token")
  );
  expect(cookie).toBeDefined();
  const session = JSON.parse(
    Buffer.from(cookie!.value.replace(/^base64-/, ""), "base64url").toString()
  );
  session.expires_at = 1;
  await context.addCookies([
    {
      ...cookie!,
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
    },
  ]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
  const renewed = (await context.cookies()).find(
    (value) => value.name === cookie!.name
  )!;
  const updated = JSON.parse(
    Buffer.from(renewed.value.replace(/^base64-/, ""), "base64url").toString()
  );
  expect(updated.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
});
for (const email of [
  "inactive@example.test",
  "unassigned@example.test",
  "unavailable@example.test",
]) {
  test(`login fails closed for ${email}`, async ({ page }) => {
    await login(page, email);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "No se pudo verificar"
    );
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
}
test("invalid credentials remain on login", async ({ page }) => {
  await login(page, "operator@example.test", "wrong-password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Revisa tus credenciales"
  );
});
test("revoked session cannot render the next protected request", async ({
  page,
  request,
}) => {
  const email = "revocation@example.test";
  await login(page, email);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
  await request.post("http://127.0.0.1:55440/test/revoke", { data: { email } });
  await page.goto("/admin/ordenes");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
test("recovery, password confirmation, one-use link and login message", async ({
  page,
}) => {
  await page.goto("/admin/recuperar");
  await page.getByLabel("Correo").fill("unknown@example.test");
  await page.getByRole("button", { name: "Enviar instrucciones" }).click();
  await expect(page.getByRole("status")).toContainText("Si existe una cuenta");
  const url =
    "/admin/auth/confirm?type=recovery&token_hash=valid-" + Date.now();
  await page.goto(url);
  await expect(page).toHaveURL(/\/admin\/restablecer$/);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("new-password-test");
  await page
    .getByLabel("Confirmar contraseña", { exact: true })
    .fill("different-password");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "deben coincidir"
  );
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("new-password-test");
  await page.getByLabel("Confirmar contraseña").fill("new-password-test");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/actualizada=1/);
  await expect(page.getByRole("status")).toContainText(
    "Contraseña actualizada"
  );
  await page.goto(url);
  await expect(page).toHaveURL(/enlace=invalido/);
  await page.goto(
    "/admin/auth/confirm?type=recovery&token_hash=expired&next=https://example.com"
  );
  await expect(page).toHaveURL(/\/admin\/login\?enlace=invalido$/);
});
