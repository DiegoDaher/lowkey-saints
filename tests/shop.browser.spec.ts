import { test, expect } from "@playwright/test";
for (const retry of [false, true]) {
  test(`catalog, cart persistence and order receipt (retry: ${retry})`, async ({
    page,
  }) => {
    let firstKey: string | undefined;
    let orderAttempts = 0;
    const productId = "10000000-0000-4000-8000-000000000001",
      variantId = "10000000-0000-4000-8000-000000000002";
    await page.route("**/functions/v1/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      let value: unknown = [];
      if (url.pathname.endsWith("/categories"))
        value = [{ id: "tops", name: "Tops", slug: "tops" }];
      if (url.pathname.endsWith("/products"))
        value = {
          items: [
            {
              id: productId,
              name: "Camiseta de prueba",
              slug: "camiseta-prueba",
              description: "Algodón",
              salePrice: "100.25",
              isArchived: false,
              version: 0,
              modelHeightCm: null,
              modelSize: null,
              images: [],
              categories: [
                { category: { id: "tops", name: "Tops", slug: "tops" } },
              ],
              measurements: [],
              variants: [
                {
                  id: variantId,
                  size: "M",
                  color: "Negro",
                  colorHex: "#111111",
                  sku: "TEST",
                  stock: 2,
                  version: 0,
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
        };
      if (url.pathname.endsWith("/orders")) {
        const body = route.request().postDataJSON();
        expect(body.items).toEqual([{ variantId, quantity: 1 }]);
        expect(body).not.toHaveProperty("totalAmount");
        orderAttempts++;
        if (retry && orderAttempts === 1) {
          firstKey = body.idempotencyKey;
          await route.fulfill({
            status: 503,
            json: { error: "Intenta de nuevo" },
            headers: { "Access-Control-Allow-Origin": "*" },
          });
          return;
        }
        if (retry) expect(body.idempotencyKey).toBe(firstKey);
        value = {
          id: productId,
          orderNumber: 42,
          status: "PENDING_PAYMENT",
          totalAmount: "100.25",
          expiresAt: "2026-10-16T12:00:00Z",
          whatsappUrl: "https://wa.me/525555555555?text=Pedido%2042",
        };
      }
      await route.fulfill({
        json: value,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Camiseta de prueba" })
    ).toBeVisible();
    await page.evaluate(
      ({ variantId }) =>
        localStorage.setItem(
          "lowkey-cart",
          JSON.stringify([
            {
              variantId,
              name: "Camiseta de prueba",
              size: "M",
              color: "Negro",
              price: "100.25",
              quantity: 1,
            },
          ])
        ),
      { variantId }
    );
    // Start a new document after seeding the persisted cart, as a returning customer.
    await page.reload();
    await page.getByRole("link", { name: "Bolsa", exact: true }).click();
    await expect(page).toHaveURL(/\/bolsa$/);
    await expect(page.getByText("Camiseta de prueba")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Camiseta de prueba")).toBeVisible();
    await page.getByLabel("Nombre", { exact: true }).fill("Cliente de prueba");
    await page.getByLabel("Teléfono", { exact: true }).fill("5555555555");
    await page
      .getByRole("button", { name: "Crear pedido", exact: true })
      .click();
    if (retry) {
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        "Intenta de nuevo"
      );
      expect(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("lowkey-cart") || "[]")
        )
      ).toHaveLength(1);
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("lowkey-pending-order") || "null")
              .key
        )
      ).toBe(firstKey);
      await page
        .getByRole("button", { name: "Crear pedido", exact: true })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: /Pedido #42/ })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Continuar en WhatsApp" })
    ).toHaveAttribute("href", "https://wa.me/525555555555?text=Pedido%2042");
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("lowkey-cart") || "[]")
      )
    ).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.getItem("lowkey-pending-order"))
    ).toBeNull();
    expect(orderAttempts).toBe(retry ? 2 : 1);
    await page.screenshot({
      path: `test-results/checkout-${retry}.png`,
      fullPage: true,
    });
  });
}
test("admin routes redirect anonymous visitors", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/admin\/login/);
  await expect(
    page.getByRole("heading", { name: "Acceso al equipo" })
  ).toBeVisible();
});
