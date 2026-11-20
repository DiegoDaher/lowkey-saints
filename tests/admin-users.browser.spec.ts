import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, role = "admin") {
  await page.goto("/140210/login");
  await page.getByLabel("Correo", { exact: true }).fill(`${role}@example.test`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/140210$/);
}

test("administrator creates both roles and handles duplicate email and mail failure", async ({
  page,
}) => {
  const users: { id: string; email: string; role: string; active: boolean }[] =
    [];
  await page.route("**/functions/v1/api/v1/admin/users**", async (route) => {
    const request = route.request();
    if (request.method() === "GET")
      return route.fulfill({ json: { users, page: 1, hasMore: false } });
    if (request.url().endsWith("password-link"))
      return route.fulfill({
        json: { message: "Solicitud de correo aceptada." },
      });
    const input = request.postDataJSON();
    if (users.some((u) => u.email === input.email))
      return route.fulfill({
        status: 409,
        json: { error: "Ya existe una cuenta con ese correo." },
      });
    users.push({ ...input, id: String(users.length), active: true });
    return route.fulfill({
      status: 201,
      json: {
        message:
          users.length === 1
            ? "Usuario creado. Solicitud de correo aceptada."
            : "Usuario creado; no se pudo enviar el enlace.",
      },
    });
  });
  await login(page);
  await page.getByRole("link", { name: "usuarios", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Usuarios", exact: true })
  ).toBeVisible();
  for (const role of ["OPERATOR", "ADMIN"]) {
    await page
      .getByLabel("Correo", { exact: true })
      .fill(`${role.toLowerCase()}-new@example.test`);
    await page
      .getByRole("combobox", { name: "Rol", exact: true })
      .selectOption(role);
    await page
      .getByRole("button", { name: "Crear usuario", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `${role.toLowerCase()}-new@example.test`,
      })
    ).toBeVisible();
  }
  await expect(
    page.getByRole("status").filter({ hasNotText: "Cargando usuarios" })
  ).toContainText("no se pudo enviar");
  await page
    .getByLabel("Correo", { exact: true })
    .fill("admin-new@example.test");
  await page
    .getByRole("button", { name: "Crear usuario", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Ya existe"
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Enviar enlace para establecer contraseña" })
    .last()
    .click();
  await expect(
    page.getByRole("status").filter({ hasNotText: "Cargando usuarios" })
  ).toContainText("Solicitud de correo aceptada");
});

for (const role of ["admin", "operator"]) {
  test(`${role} changes own password from profile with current-password validation`, async ({
    page,
  }) => {
    await login(page, role);
    await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Mi perfil", exact: true })
    ).toBeVisible();
    await page
      .getByLabel("Contraseña actual", { exact: true })
      .fill("wrong-password");
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("New-valid-password-123!");
    await page
      .getByLabel("Confirmar nueva contraseña", { exact: true })
      .fill("Different-password-123!");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "deben coincidir"
    );
    // React resets uncontrolled inputs after the action completes.
    await page
      .getByLabel("Contraseña actual", { exact: true })
      .fill("wrong-password");
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("New-valid-password-123!");
    await page
      .getByLabel("Confirmar nueva contraseña", { exact: true })
      .fill("New-valid-password-123!");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "No se pudo cambiar"
    );
    await page
      .getByLabel("Contraseña actual", { exact: true })
      .fill("test-only-password");
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("New-valid-password-123!");
    await page
      .getByLabel("Confirmar nueva contraseña", { exact: true })
      .fill("New-valid-password-123!");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/140210\/login\?actualizada=1$/);
    await expect(
      page.getByRole("status").filter({ hasNotText: "Cargando usuarios" })
    ).toContainText("Contraseña actualizada");
  });
}

test("operator cannot open Users; anonymous profile requires login", async ({
  page,
}) => {
  const response = await page.goto("/140210/perfil");
  expect(response?.status()).toBe(401);
  await login(page, "operator");
  await expect(
    page.getByRole("link", { name: "usuarios", exact: true })
  ).toHaveCount(0);
  await page.goto("/140210/usuarios");
  await expect(page).toHaveURL(/\/140210\/sin-acceso$/);
});
