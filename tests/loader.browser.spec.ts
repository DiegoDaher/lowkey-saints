import { test, expect } from "@playwright/test";

for (const width of [375, 1440]) {
  test(`catalog loader lifecycle and reduced motion at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/functions/v1/api/v1/products?**", async (route) => {
      await pending;
      await route.fulfill({ json: { items: [], pages: 1, total: 0 } });
    });
    await page.route("**/functions/v1/api/v1/categories", (route) =>
      route.fulfill({ json: [] })
    );
    await page.goto("/");
    const loader = page.locator(".saints-loader");
    await expect(loader).toHaveText("Cargando productos…");
    await expect(loader.locator("svg")).toHaveCount(3);
    await loader.scrollIntoViewIfNeeded();
    const ids = await loader
      .locator("[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    await expect(loader.locator("g > path").first()).toHaveCSS(
      "fill",
      "rgb(201, 166, 107)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(loader.locator("svg").first()).toHaveCSS(
      "animation-name",
      "none"
    );
    await expect(loader.locator("svg").first()).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`loader-${width}.png`) });
    release();
    await expect(loader).toHaveCount(0);
    await expect(page.getByText("No hay productos disponibles")).toBeVisible();
  });
}

test("inline loader ends on failure and permits retry", async ({
  page,
}, testInfo) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/functions/v1/api/v1/unsubscribe", async (route) => {
    await pending;
    await route.fulfill({
      status: 500,
      json: { error: "No se pudo cancelar" },
    });
  });
  await page.goto("/baja?token=test");
  const button = page.getByRole("button", { name: "Confirmar baja" });
  const before = await button.boundingBox();
  await button.click();
  const busy = page.getByRole("button", { name: "Cancelando avisos…" });
  try {
    await expect(busy).toBeDisabled();
    await expect(busy.locator(".saints-loader--inline")).toBeVisible();
    expect((await busy.boundingBox())?.height).toBe(before?.height);
    await page.screenshot({ path: testInfo.outputPath("loader-inline.png") });
  } finally {
    release();
  }
  await expect(button).toBeEnabled();
  await expect(page.locator(".saints-loader")).toHaveCount(0);
});
