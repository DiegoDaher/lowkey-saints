import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import { postgresTlsConfig } from "../supabase/functions/_shared/postgres-tls.mjs";

const root = new URL("../prisma/products/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8")
);
const db = new pg.Client({
  ...postgresTlsConfig(process.env.DIRECT_URL),
  connectionTimeoutMillis: 15000,
});
const slugs = manifest.products.map((p) => p.slug);
const expectedVariants = manifest.products.reduce((n, p) => n + p.variants.length, 0);
const expectedImages = manifest.products.reduce((n, p) => n + p.images.length, 0);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function snapshot() {
  const result = {};
  result.products = (
    await db.query(
      'SELECT * FROM "Product" WHERE slug=ANY($1::text[]) ORDER BY id',
      [slugs]
    )
  ).rows;
  const ids = result.products.map((p) => p.id);
  for (const table of ["ProductVariant", "ProductImage", "ProductCategory"]) {
    result[table] = (
      await db.query(
        `SELECT * FROM "${table}" WHERE "productId"=ANY($1::text[]) ORDER BY row_to_json("${table}")::text`,
        [ids]
      )
    ).rows;
  }
  return result;
}
async function api(path) {
  const response = await fetch(
    process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/api/v1" + path,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(20000),
    }
  );
  assert.equal(response.status, 200, path);
  return response.json();
}
try {
  await db.connect();
  const before = await snapshot();
  assert.equal(before.products.length, manifest.products.length);
  assert.equal(before.ProductVariant.length, expectedVariants);
  assert.equal(before.ProductImage.length, expectedImages);
  // Explicit opt-in: exercise the real importer, then compare all persisted fields.
  if (process.argv.includes("--check-repeat")) {
    execFileSync(
      process.execPath,
      ["scripts/import-product-batch.mjs", "--apply"],
      { stdio: "pipe" }
    );
    assert.deepEqual(
      await snapshot(),
      before,
      "Repeat import changed persisted data"
    );
  }
  const catalog = await api("/products");
  for (const p of manifest.products)
    assert(
      catalog.items.some((item) => item.slug === p.slug),
      `Missing catalog item ${p.slug}`
    );
  const verified = [];
  for (const p of manifest.products) {
    const detail = await api("/products/" + p.slug);
    assert.equal(Number(detail.salePrice), Number(p.salePrice));
    assert.equal(detail.name, p.name);
    assert(detail.categories.some((c) => c.category.slug === p.category));
    assert.equal(detail.images.length, p.images.length);
    assert.equal(detail.variants.length, p.variants.length);
    for (const v of p.variants) {
      const actual = detail.variants.find((item) => item.sku === v.sku);
      assert(actual);
      assert.equal(actual.size, v.size);
      assert.equal(actual.color, v.color);
      // Stock is checked only when explicitly verifying the initial load.
      if (process.argv.includes("--initial-stock"))
        assert.equal(actual.stock, v.stock);
    }
    for (const [i, im] of detail.images.entries()) {
      const response = await fetch(im.url, {
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(response.status, 200);
      assert.equal(
        hash(Buffer.from(await response.arrayBuffer())),
        hash(await readFile(new URL("prepared/" + p.images[i].file, root)))
      );
    }
    verified.push({
      slug: p.slug,
      price: detail.salePrice,
      variants: detail.variants.length,
      images: detail.images.length,
    });
  }
  const report = {
    verifiedAt: new Date().toISOString(),
    products: manifest.products.length,
    variants: expectedVariants,
    images: expectedImages,
    totalStock: before.ProductVariant.reduce((sum, v) => sum + v.stock, 0),
    repeatImportPreservedData: process.argv.includes("--check-repeat"),
    initialStockVerified: process.argv.includes("--initial-stock"),
    publicApiAndImageHashesVerified: true,
    items: verified,
  };
  await writeFile(
    new URL("verification.json", root),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.end();
}
