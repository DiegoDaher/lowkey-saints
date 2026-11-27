import { test, expect } from "@playwright/test";

const URL = "/productos/variantes-prueba";

test("variant selector updates stock alert and CTA state", async ({ page }) => {
  await page.goto(URL);
  const cta = page.getByRole("button", { name: "Agregar a la bolsa" });

  await expect(page.getByRole("button", { name: "Talla M" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Disponible" })
  ).toBeVisible();
  await expect(cta).toBeEnabled();

  await page.getByRole("button", { name: "Color Blanco" }).click();
  await expect(page.getByText("Últimas 2 piezas")).toBeVisible();
  await expect(cta).toBeEnabled();

  await page.getByRole("button", { name: "Talla L" }).click();
  await expect(page.getByText("Última pieza")).toBeVisible();

  await page.getByRole("button", { name: /^Color Negro/ }).click();
  await expect(page.getByText("Agotado", { exact: true })).toBeVisible();
  await expect(cta).toBeDisabled();
  await expect(page.getByLabel("Avísame cuando vuelva")).toBeVisible();
  await expect(
    page.getByText("Selecciona otra talla o color para ver su disponibilidad.")
  ).toBeVisible();
});

test("archived variants are not offered", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("button", { name: /^Talla S/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Talla XL/ })).toHaveCount(1);
});

test("nonexistent combination keeps the new choice and picks an in-stock variant", async ({
  page,
}) => {
  await page.goto(URL); // M / Negro; XL only exists in Blanco
  await page.getByRole("button", { name: /^Talla XL/ }).click();
  await expect(page.getByRole("button", { name: /^Talla XL/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.getByRole("button", { name: /^Color Blanco/ })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Agregar a la bolsa" })
  ).toBeEnabled();
});

test("cart quantity cannot exceed stock", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("button", { name: "Color Blanco" }).click(); // M / Blanco, stock 2
  const cta = page.getByRole("button", { name: "Agregar a la bolsa" });
  await cta.click();
  await page.keyboard.press("Escape");
  await expect(cta).toBeEnabled();
  await cta.click();
  await page.keyboard.press("Escape");
  await expect(cta).toBeDisabled();
  await expect(
    page.getByText("Ya tienes todas las piezas disponibles en tu bolsa")
  ).toBeVisible();
  const cart = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cart-storage") || "{}").items
  );
  expect(cart).toHaveLength(1);
  expect(cart[0].quantity).toBe(2);
});

test("selector is keyboard operable with arrows", async ({ page }) => {
  await page.goto(URL);
  const negro = page.getByRole("button", { name: /^Color Negro/ });
  await negro.focus();
  await page.keyboard.press("ArrowRight");
  const blanco = page.getByRole("button", { name: /^Color Blanco/ });
  await expect(blanco).toBeFocused();
  await expect(blanco).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(negro).toHaveAttribute("aria-pressed", "true");
  // Roving tabindex: only the selected option is in the tab order.
  await expect(blanco).toHaveAttribute("tabindex", "-1");
});

test("no horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(URL);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});

test("side-cart opens on add, edits quantities in cents and persists", async ({
  page,
}) => {
  await page.goto(URL);
  const bag = page.getByRole("button", { name: /^Bolsa/ });
  await page.getByRole("button", { name: "Agregar a la bolsa" }).click();
  const drawer = page.getByRole("dialog", { name: /Tu bolsa/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId("hold-notice")).toContainText("60 minutos");
  // Background keeps its width: the scrollbar gutter is reserved.
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollbarGutter
    )
  ).toBe("stable");

  await drawer.getByRole("button", { name: /^Aumentar cantidad/ }).click();
  await expect(drawer.getByTestId("side-cart-subtotal")).toHaveText(
    /1,998\.00/
  );
  await expect(drawer).toHaveAccessibleName("Tu bolsa (2)");

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(bag).toHaveAccessibleName("Bolsa, 2 artículos");
  // Focus returns to whatever opened the drawer.
  await expect(
    page.getByRole("button", { name: "Agregar a la bolsa" })
  ).toBeFocused();
  await bag.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bag).toBeFocused();

  await page.reload();
  await expect(bag).toHaveAccessibleName("Bolsa, 2 artículos");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cart-storage") || "{}")
  );
  expect(stored.items[0]).toMatchObject({
    variantId: "v-m-negro",
    priceCents: 99900,
    quantity: 2,
    maxQuantity: 5,
  });
  expect(Number.isInteger(stored.heldAt)).toBe(true);

  await bag.click();
  await drawer.getByRole("button", { name: /de la bolsa$/ }).click();
  await expect(drawer.getByText("Tu bolsa está vacía.")).toBeVisible();
});

test("expired hold warns but keeps the items", async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() =>
    localStorage.setItem(
      "cart-storage",
      JSON.stringify({
        heldAt: Date.now() - 61 * 60_000,
        items: [
          {
            variantId: "v-m-negro",
            slug: "variantes-prueba",
            name: "Chamarra de variantes",
            size: "M",
            color: "Negro",
            priceCents: 99900,
            maxQuantity: 5,
            quantity: 1,
          },
        ],
      })
    )
  );
  await page.reload();
  await page.getByRole("button", { name: "Bolsa, 1 artículo" }).click();
  const drawer = page.getByRole("dialog", { name: /Tu bolsa/ });
  await expect(drawer.getByTestId("hold-notice")).toContainText(
    "ya no está apartada"
  );
  await expect(drawer.getByText("Chamarra de variantes")).toBeVisible();
});
