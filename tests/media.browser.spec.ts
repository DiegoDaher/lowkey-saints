import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

const fixture = "http://127.0.0.1:55440";
test.setTimeout(60000);
async function openEditor(page: Page) {
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo", { exact: true })
    .fill("inventory-admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/productos");
  await page
    .getByRole("button", { name: "Editar Prenda 1", exact: true })
    .click();
  await expect(page.locator('input[type="file"]')).toBeEnabled();
}
async function photo(name = "foto.jpg") {
  return {
    name,
    mimeType: "image/jpeg",
    buffer: await sharp({
      create: { width: 3200, height: 2400, channels: 3, background: "#c34523" },
    })
      .jpeg()
      .toBuffer(),
  };
}
test.beforeEach(async ({ request }) => {
  await request.post(fixture + "/test/inventory/reset");
});

test("multiple uploads compress, preserve order, recover failures and persist the cover", async ({
  page,
  request,
}) => {
  let fail = true;
  const bodies: Buffer[] = [];
  await page.route("**/functions/v1/api/v1/admin/images", async (route) => {
    bodies.push(route.request().postDataBuffer()!);
    if (fail) {
      fail = false;
      await route.fulfill({ status: 502, json: { error: "Fallo temporal" } });
    } else await route.continue();
  });
  await openEditor(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles([await photo("primera.jpg"), await photo("segunda.jpg")]);
  await expect(page.getByText("1 de 2 fotografías listas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar producto", exact: true })
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("2 de 2 fotografías listas")).toBeVisible();
  expect(bodies).toHaveLength(3);
  const metadata = await sharp(bodies[0]).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 1600, height: 1200 });
  await expect(page.getByLabel("Descripción de la foto 1")).toBeVisible();
  await page
    .getByLabel("Descripción de la foto 1")
    .fill("Portada personalizada");
  const state = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const saved = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  expect(
    saved.inventory[0].images.map((im: { path: string }) => im.path)
  ).toEqual([state.mediaRequests[1].path, state.mediaRequests[0].path]);
  expect(saved.inventory[0].images[0].alt).toBe("Portada personalizada");
  await page
    .getByRole("button", { name: "Editar Prenda 1", exact: true })
    .click();
  await expect(page.getByText("2 de 2 fotografías listas")).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const removed = await (
    await request.get(fixture + "/test/inventory/state")
  ).json();
  expect(removed.inventory[0].images).toHaveLength(1);
  expect(removed.mediaDeletes).toHaveLength(0); // Attached photos are removed through product save.
});

test("drop accepts files, rejects overflow, allows removing corrupt files and warns on discard", async ({
  page,
  request,
}) => {
  await openEditor(page);
  const image = await photo();
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      Array.from({ length: 13 }, (_, i) => ({ ...image, name: `${i}.jpg` }))
    );
  await expect(
    page.getByText("Máximo 12 fotografías, incluidas las pendientes")
  ).toBeVisible();
  const transfer = await page.evaluateHandle(
    ({ data }) => {
      const dt = new DataTransfer();
      dt.items.add(
        new File(
          [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
          "arrastrada.jpg",
          { type: "image/jpeg" }
        )
      );
      dt.items.add(new File(["corrupt"], "rota.jpg", { type: "image/jpeg" }));
      return dt;
    },
    { data: image.buffer.toString("base64") }
  );
  await page
    .getByRole("region", { name: "Fotografías del producto" })
    .locator("div")
    .first()
    .dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.getByText("1 de 2 fotografías listas")).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar", exact: true })
    .last()
    .click();
  await expect(page.getByText("1 de 1 fotografías listas")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText("1 de 1 fotografías listas")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.locator('input[type="file"]')).toBeVisible();
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(fixture + "/test/inventory/state")).json())
          .mediaDeletes.length
    )
    .toBe(1);
  await expect(page.getByText("0 de 0 fotografías listas")).toBeVisible();
});
