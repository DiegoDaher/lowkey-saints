import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

async function requestLink(page: Page, request: APIRequestContext) {
  const email = `recovery-${Date.now()}@example.test`;
  await page.goto("/140210/recuperar");
  await page.getByLabel("Correo").fill(email);
  await page.getByRole("button", { name: "Enviar instrucciones" }).click();
  await expect(page.getByRole("status")).toContainText("este mismo navegador");
  const response = await request.get(
    `http://127.0.0.1:55440/test/recovery?email=${encodeURIComponent(email)}`
  );
  const recovery = await response.json();
  expect(recovery.redirectTo).toBe("http://localhost:3102/140210/auth/confirm");
  expect(recovery.challenge).toBeTruthy();
  return `${recovery.redirectTo}?code=${recovery.code}`;
}

test("default email exchanges PKCE code, updates password and rejects reuse", async ({
  page,
  request,
}) => {
  const link = await requestLink(page, request);
  await page.goto(`${link}&next=https://example.com`);
  await expect(page).toHaveURL(/\/140210\/restablecer$/);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("new-password-test");
  await page.getByLabel("Confirmar contraseña").fill("new-password-test");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/140210\/login\?actualizada=1$/);
  await page.goto(link);
  await expect(page).toHaveURL(/\/140210\/login\?enlace=invalido$/);
});

test("default email rejects a browser without the verifier", async ({
  page,
  request,
  browser,
}) => {
  const link = await requestLink(page, request);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(link);
    await expect(otherPage).toHaveURL(/\/140210\/login\?enlace=invalido$/);
  } finally {
    await other.close();
  }
});

test("custom recovery templates still work and expired links fail closed", async ({
  page,
}) => {
  await page.goto(
    `/140210/auth/confirm?type=recovery&token_hash=valid-${Date.now()}`
  );
  await expect(page).toHaveURL(/\/140210\/restablecer$/);
  await page.goto(
    "/140210/auth/confirm?type=recovery&token_hash=expired&next=https://example.com"
  );
  await expect(page).toHaveURL(/\/140210\/login\?enlace=invalido$/);
});
