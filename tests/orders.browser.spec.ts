import { test, expect, type Page } from "@playwright/test";

const id = "10000000-0000-4000-8000-000000000001";
function order(
  status = "PENDING_PAYMENT",
  availableActions = ["CONFIRMED", "CANCELLED"]
) {
  return {
    id,
    orderNumber: 123,
    status,
    availableActions,
    clientName: "Cliente de prueba",
    clientPhone: "5555555555",
    totalAmount: "100.25",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    items: [
      {
        productName: "Camiseta",
        size: "M",
        color: "Negro",
        quantity: 1,
        price: "100.25",
      },
    ],
  };
}
async function login(page: Page) {
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo", { exact: true })
    .fill("operator@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "ordenes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pedidos", exact: true })
  ).toBeVisible();
}

test("orders route redirects anonymous visitors", async ({ page }) => {
  await page.goto("/admin/ordenes");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("manual transitions, history, conflicts, filter and pagination", async ({
  page,
}) => {
  let current = order();
  let conflict = false;
  let writes = 0;
  let lastQuery = "";
  await page.route("**/functions/v1/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    let value: unknown = [];
    let status = 200;
    if (url.pathname.endsWith("/admin/me"))
      value = { id, role: "STAFF", active: true };
    else if (url.pathname.endsWith("/admin/products")) value = { items: [] };
    else if (url.pathname.endsWith("/history"))
      value = [
        {
          id: "event",
          fromStatus: "PENDING_PAYMENT",
          toStatus: current.status,
          createdAt: current.updatedAt,
          source: "MANUAL",
          actorId: id,
        },
      ];
    else if (route.request().method() === "PATCH") {
      writes++;
      const target = route.request().postDataJSON().status;
      current = order(target, target === "CONFIRMED" ? ["SHIPPED"] : []);
      if (conflict) {
        status = 409;
        value = { error: "El pedido cambió" };
      } else value = current;
    } else if (url.pathname.endsWith("/admin/orders")) {
      lastQuery = url.search;
      value = url.searchParams.get("status")
        ? []
        : url.searchParams.get("page") === "2"
          ? []
          : [
              current,
              ...Array.from({ length: 49 }, (_, i) => ({
                ...order("SHIPPED", []),
                id: `other-${i}`,
                orderNumber: 200 + i,
              })),
            ];
    }
    await route.fulfill({
      status,
      json: value,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await login(page);
  const card = page.getByRole("region", { name: "Pedido #123", exact: true });
  await expect(
    card.getByText("Pendiente de pago", { exact: true })
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await card.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(card.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Cancelar", exact: true })
  ).toHaveCount(0);
  await card.getByText("Historial", { exact: true }).click();
  await expect(
    card.getByText(`Operador: ${id}`, { exact: false })
  ).toBeVisible();
  await expect(card.getByText(/Historial previo no disponible/)).toBeVisible();
  conflict = true;
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Marcar enviado" }).click();
  await expect(
    page.getByText(/El pedido cambió.*Se actualizaron/)
  ).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
  await expect(page.getByText("No hay pedidos en esta página.")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("CANCELLED");
  await expect.poll(() => lastQuery).toContain("page=1&status=CANCELLED");
});

test("expired reservations, refresh and server errors", async ({ page }) => {
  await page.clock.install();
  let current = {
    ...order(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  };
  let fail = false;
  let reads = 0;
  await page.route("**/functions/v1/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let value: unknown = [];
    let status = 200;
    if (path.endsWith("/admin/me")) value = { id, role: "ADMIN", active: true };
    if (path.endsWith("/admin/products")) value = { items: [] };
    if (path.endsWith("/admin/orders")) {
      reads++;
      value = fail
        ? { error: "Servicio temporalmente no disponible" }
        : [current];
      if (fail) status = 503;
    }
    await route.fulfill({
      status,
      json: value,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await login(page);
  await expect(
    page.getByText("Reserva vencida", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar pago" })
  ).toHaveCount(0);
  current = order("CANCELLED", []);
  const before = reads;
  await page.clock.runFor(30_000);
  await expect.poll(() => reads).toBeGreaterThan(before);
  await expect(
    page
      .getByRole("region", { name: "Pedido #123", exact: true })
      .getByText("Cancelado", { exact: true })
  ).toBeVisible();
  fail = true;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Servicio temporalmente no disponible"
  );
  fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});
