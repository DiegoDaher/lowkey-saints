import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email = "operator@example.test") {
  await page.goto("/140210/login");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/140210$/, { timeout: 15000 });
}

for (const path of ["/pagina-perdida", "/admin", "/admin/login"]) {
  test(`404 conceals unavailable route ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Error 404"
    );
    await expect(
      page.getByRole("link", { name: "Volver al inicio" })
    ).toHaveAttribute("href", "/");
  });
}

for (const path of [
  "/401",
  "/140210",
  "/140210/productos",
  "/140210/inventario",
  "/140210/ordenes",
]) {
  test(`anonymous access shows 401 without advertising login: ${path}`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(401);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Error 401"
    );
    await expect(
      page.locator('a[href*="login"], input[type="password"]')
    ).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/
    );
    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL("/");
  });
}

test("authorized access, refresh and permission denial remain distinct", async ({
  page,
  context,
}) => {
  await login(page);
  const cookie = (await context.cookies()).find((value) =>
    value.name.endsWith("-auth-token")
  )!;
  const session = JSON.parse(
    Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString()
  );
  session.expires_at = 1;
  await context.addCookies([
    {
      ...cookie,
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
    },
  ]);
  const response = await page.goto("/140210/inventario");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(
    "Error 401"
  );
  const renewed = (await context.cookies()).find(
    (value) => value.name === cookie.name
  )!;
  expect(
    JSON.parse(
      Buffer.from(renewed.value.replace(/^base64-/, ""), "base64url").toString()
    ).expires_at
  ).toBeGreaterThan(Math.floor(Date.now() / 1000));
  await page.goto("/140210/productos");
  await expect(page).toHaveURL(/\/140210\/sin-acceso$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Sin acceso administrativo"
  );
});

test("revoked session shows 401 on the next protected request", async ({
  page,
  request,
}) => {
  const email = `space-revoked-${Date.now()}@example.test`;
  await login(page, email);
  await request.post("http://127.0.0.1:55440/test/revoke", { data: { email } });
  const response = await page.goto("/140210/ordenes");
  expect(response?.status()).toBe(401);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Error 401"
  );
});

test("expired client session exits the panel to 401", async ({
  page,
  context,
}) => {
  await login(page, "admin@example.test");
  await context.clearCookies();
  await page.getByRole("link", { name: "Finanzas", exact: true }).click();
  await expect(page).toHaveURL(/\/140210\/finanzas$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Error 401"
  );
});

for (const width of [360, 768, 1440]) {
  test(`space scenes fit at ${width}px and respect reduced motion`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [path, code] of [
      ["/pagina-perdida", 404],
      ["/401", 401],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        `Error ${code}`
      );
      const images = page.locator("main img");
      await expect(images).toHaveCount(3);
      await expect
        .poll(() =>
          images.evaluateAll((nodes) =>
            nodes.every((node) => (node as HTMLImageElement).naturalWidth > 0)
          )
        )
        .toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
      expect(
        await page
          .locator("main img")
          .first()
          .evaluate((img) => getComputedStyle(img.parentElement!).animationName)
      ).toBe("none");
      await page.screenshot({
        path: testInfo.outputPath(`${code}-${width}.png`),
        fullPage: true,
      });
    }
  });
}
