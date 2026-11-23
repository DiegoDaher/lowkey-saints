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
  await expect(cta).toBeEnabled();
  await cta.click();
  await expect(cta).toBeDisabled();
  await expect(
    page.getByText("Ya tienes todas las piezas disponibles en tu bolsa")
  ).toBeVisible();
  const cart = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lowkey-cart") || "[]")
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
