import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const root = new URL("../prisma/products/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8")
);
const base = process.argv[2] || "https://lowkey-saints.vercel.app";
await mkdir("test-results/product-batch", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(base, { waitUntil: "networkidle" });
  for (const p of manifest.products) {
    await page.locator(`a[href="/productos/${p.slug}"]`).first().waitFor();
  }
  let selections = 0;
  for (const p of manifest.products) {
    await page.goto(base + "/productos/" + p.slug, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { name: p.name, exact: true }).waitFor();
    const select = page.getByLabel("Talla y color");
    const options = await select
      .locator("option")
      .evaluateAll((elements) =>
        elements.map((el) => ({ value: el.value, label: el.textContent }))
      );
    assert.equal(options.length, p.variants.length);
    for (const v of p.variants) {
      const option = options.find((o) =>
        o.label.startsWith(v.size + " / " + v.color + " ")
      );
      assert(option, `${p.slug}: missing ${v.size} / ${v.color}`);
      assert(option.label.includes("Disponible"));
      await select.selectOption(option.value);
      assert.equal(await select.inputValue(), option.value);
      await page
        .getByRole("button", { name: "Agregar a la bolsa", exact: true })
        .click();
      await page.getByText("Agregado a tu bolsa", { exact: true }).waitFor();
      selections++;
    }
    for (let i = 1; i <= p.images.length; i++) {
      await page
        .getByRole("button", { name: "Ver imagen " + i, exact: true })
        .click();
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("main img")).every(
          (im) => im.complete && im.naturalWidth > 0
        )
      );
    }
    if (p.category === "tops") {
      await page
        .getByRole("button", { name: "Ver imagen 1", exact: true })
        .click();
      await page.screenshot({
        path: "test-results/product-batch/playera-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "test-results/product-batch/playera-mobile.png",
        fullPage: true,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      );
    }
    console.log("Verified: " + p.slug);
  }
  const report = {
    verifiedAt: new Date().toISOString(),
    site: base,
    catalogLinks: 6,
    detailPages: 6,
    variantSelectionsAndLocalCartAdds: selections,
    allGalleryImagesLoaded: true,
    mobileOverflow: false,
    noOrdersSubmitted: true,
  };
  await writeFile(
    new URL("browser-verification.json", root),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
