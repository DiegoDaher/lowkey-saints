import { test, expect, type Page } from "@playwright/test";

async function mockCatalog(page: Page) {
  const requests: URL[] = [];
  await page.route("**/functions/v1/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/categories")) {
      await route.fulfill({ json: [{ name: "Tops" }, { name: "Pantalones" }] });
      return;
    }
    if (url.pathname.endsWith("/products")) {
      requests.push(url);
      await route.fulfill({
        json: {
          items: [
            {
              id: "hoodie",
              name: "Hoodie de prueba",
              slug: "hoodie-prueba",
              salePrice: "1999",
              description: "Prenda de prueba",
              images: [{ url: "/images/editorial/alo-coffee.webp" }],
              categories: [{ category: { name: "Tops" } }],
              variants: [
                {
                  id: "variant",
                  size: "M",
                  color: "Café",
                  colorHex: "#70513e",
                  stock: 3,
                },
              ],
            },
          ],
          total: 2,
          pages: 2,
        },
      });
      return;
    }
    await route.continue();
  });
  return requests;
}

async function applyFilters(page: Page) {
  await page.getByRole("button", { name: /^Filtrar productos/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Categoría", { exact: true }).selectOption("Tops");
  await dialog.getByLabel("Desde", { exact: true }).fill("500");
  await dialog.getByLabel("Hasta", { exact: true }).fill("2500");
  await dialog.getByText("M", { exact: true }).click();
  await dialog.getByRole("checkbox", { name: "Café", exact: true }).check();
  await dialog.getByRole("button", { name: "APLICAR FILTROS" }).click();
  await expect(
    page.getByRole("button", { name: "Filtrar productos, 5 filtros activos" })
  ).toBeVisible();
}

for (const width of [375, 768, 1440]) {
  test(`storefront navigation and layout at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = await mockCatalog(page);
    await page.goto("/");
    const header = page.locator("header");
    const logo = header.getByRole("link", { name: "Lowkey Saints, inicio" });
    const selectNav = async (name: string) => {
      if (width < 1024)
        await header.getByRole("button", { name: "Abrir menú" }).click();
      await header.getByRole("link", { name, exact: true }).click();
    };
    await expect(
      page.getByRole("heading", { name: "Hoodie de prueba" })
    ).toBeVisible();
    await applyFilters(page);
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect
      .poll(() => requests.at(-1)?.searchParams.get("page"))
      .toBe("2");
    await logo.click();
    await expect
      .poll(() => requests.at(-1)?.search)
      .toBe("?page=1&sort=relevancia");
    await expect(page).toHaveURL(/\/#inicio$/);
    await expect
      .poll(() =>
        page
          .locator("#inicio")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top))
      )
      .toBeGreaterThanOrEqual(70);

    await applyFilters(page);
    await selectNav("Pantalones");
    await expect
      .poll(() => requests.at(-1)?.search)
      .toBe("?page=1&sort=relevancia&category=Pantalones");
    await expect(page).toHaveURL(/\/#catalogo$/);
    if (width < 1024)
      await expect(
        header.getByRole("button", { name: "Abrir menú" })
      ).toHaveAttribute("aria-expanded", "false");
    await expect
      .poll(() =>
        page
          .locator("#catalogo")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top))
      )
      .toBeGreaterThanOrEqual(72);

    await page
      .getByRole("link", { name: "VER COLECCIÓN", exact: true })
      .click();
    await expect
      .poll(() => requests.at(-1)?.search)
      .toBe("?page=1&sort=relevancia");
    await selectNav("Tops");
    await header.getByRole("link", { name: "Bolsa", exact: true }).click();
    await selectNav("Tops");
    await expect(page).toHaveURL(/\/#catalogo$/);
    await expect
      .poll(() => requests.at(-1)?.searchParams.get("category"))
      .toBe("Tops");
    await page
      .getByRole("link", { name: "Ver Hoodie de prueba", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Hoodie de prueba" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Agregar a la bolsa" }).click();
    await selectNav("Inicio");
    await expect
      .poll(() => requests.at(-1)?.search)
      .toBe("?page=1&sort=relevancia");
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("lowkey-cart") || "[]").length
        )
      )
      .toBe(1);
    await header.getByRole("link", { name: "Bolsa", exact: true }).click();
    await logo.click();
    await expect(page).toHaveURL(/\/#inicio$/);
    await expect
      .poll(() => requests.at(-1)?.search)
      .toBe("?page=1&sort=relevancia");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await logo.focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(() =>
        page.locator("#inicio").evaluate((el) => el.getBoundingClientRect().top)
      )
      .toBeLessThanOrEqual(120);
    await expect
      .poll(() =>
        page
          .locator("#inicio")
          .evaluate((el) => el.getBoundingClientRect().bottom)
      )
      .toBeGreaterThan(200);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator(".store-hero img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0
            )
          )
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`storefront-${width}.png`),
      fullPage: true,
    });
  });
}
