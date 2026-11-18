import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { postgresTlsConfig } from "../supabase/functions/_shared/postgres-tls.mjs";

const apply = process.argv.includes("--apply");
const root = new URL("../prisma/products/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8")
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
function stableId(key) {
  const h = hash(manifest.batch + ":" + key);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const slugs = manifest.products.map((p) => p.slug);
assert.equal(new Set(slugs).size, slugs.length);
const skus = manifest.products.flatMap((p) => p.variants.map((v) => v.sku));
assert.equal(new Set(skus).size, skus.length);
for (const p of manifest.products) {
  assert.match(p.salePrice, /^\d+\.\d{2}$/);
  assert.match(p.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert(p.images.length > 0 && p.images.length <= 12);
  p.id = stableId(p.slug);
  for (const v of p.variants) {
    assert(Number.isInteger(v.stock) && v.stock >= 0);
    assert.match(v.colorHex, /^#[a-fA-F0-9]{6}$/);
    v.id = stableId(v.sku);
  }
  for (const im of p.images) {
    im.bytes = await readFile(new URL("prepared/" + im.file, root));
    const metadata = await sharp(im.bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert(im.bytes.length < 5 * 1024 * 1024);
    im.path = stableId(hash(im.bytes)) + ".webp";
  }
}
const db = new pg.Client({
  ...postgresTlsConfig(process.env.DIRECT_URL),
  connectionTimeoutMillis: 15000,
});
const storage = apply
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    ).storage.from("product-images")
  : null;
const registry = apply
  ? new pg.Client({
      ...postgresTlsConfig(process.env.DIRECT_URL),
      connectionTimeoutMillis: 15000,
    })
  : null;
let transaction = false;
try {
  await db.connect();
  if (registry) await registry.connect();
  await db.query(apply ? "BEGIN" : "BEGIN READ ONLY");
  transaction = true;
  if (apply)
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      manifest.batch,
    ]);
  const existing = (
    await db.query(
      'SELECT id,name,slug,"isArchived" FROM "Product" ORDER BY slug'
    )
  ).rows;
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      existingProductsIncludingArchived: existing,
    })
  );
  const created = [];
  const skipped = [];
  for (const p of manifest.products) {
    const match = existing.find(
      (row) => row.slug === p.slug || row.id === p.id || row.name === p.name
    );
    if (match) {
      assert.equal(
        match.id,
        p.id,
        `Existing product conflicts with ${p.slug}; manual reconciliation required`
      );
      assert.equal(match.slug, p.slug);
      const variants = (
        await db.query(
          'SELECT id,sku,size,color FROM "ProductVariant" WHERE "productId"=$1 ORDER BY sku',
          [p.id]
        )
      ).rows;
      assert.deepEqual(
        variants,
        p.variants
          .map(({ id, sku, size, color }) => ({ id, sku, size, color }))
          .sort((a, b) => a.sku.localeCompare(b.sku))
      );
      const images = (
        await db.query(
          'SELECT path FROM "ProductImage" WHERE "productId"=$1 ORDER BY position',
          [p.id]
        )
      ).rows;
      assert.deepEqual(
        images.map((im) => im.path),
        p.images.map((im) => im.path)
      );
      // Preserve all live inventory, prices, archive state and editorial changes.
      skipped.push(p.slug);
      continue;
    }
    const category = (
      await db.query('SELECT id FROM "Category" WHERE slug=$1', [p.category])
    ).rows[0];
    assert(category, `Missing category: ${p.category}`);
    const collisions = (
      await db.query(
        'SELECT sku FROM "ProductVariant" WHERE sku=ANY($1::text[])',
        [p.variants.map((v) => v.sku)]
      )
    ).rows;
    assert.equal(collisions.length, 0, `SKU collision for ${p.slug}`);
    if (!apply) continue;
    for (const im of [...p.images].sort((a, b) =>
      a.path.localeCompare(b.path)
    )) {
      // Commit the reservation separately so a failed import remains discoverable.
      if (
        !(
          await registry.query(
            'SELECT id FROM "ProductMediaAsset" WHERE path=$1',
            [im.path]
          )
        ).rowCount
      )
        await registry.query(
          `INSERT INTO "ProductMediaAsset" (id,path,state,"expiresAt")
        VALUES ($1,$2,'UPLOADING',now() + interval '24 hours') ON CONFLICT (path) DO NOTHING`,
          [randomUUID(), im.path]
        );
      const asset = (
        await db.query(
          'SELECT state FROM "ProductMediaAsset" WHERE path=$1 FOR UPDATE',
          [im.path]
        )
      ).rows[0];
      assert(
        ["UPLOADING", "TEMPORARY", "ATTACHED"].includes(asset.state),
        `Media unavailable: ${im.path}; do not resurrect a deletion candidate`
      );
      const { error } = await storage.upload(im.path, im.bytes, {
        contentType: "image/webp",
        upsert: false,
      });
      if (
        error &&
        !["409", "Duplicate"].includes(String(error.statusCode)) &&
        !/already exists|duplicate/i.test(error.message)
      ) {
        throw new Error(
          `Storage upload failed for ${im.file}: ${error.message}`
        );
      }
      const response = await fetch(
        storage.getPublicUrl(im.path).data.publicUrl,
        { signal: AbortSignal.timeout(20000) }
      );
      assert(response.ok, `Public image unavailable: ${im.file}`);
      assert.equal(
        hash(Buffer.from(await response.arrayBuffer())),
        hash(im.bytes),
        `Stored image mismatch: ${im.file}`
      );
    }
    await db.query(
      'INSERT INTO "Product" (id,name,slug,description,materials,specifications,"salePrice","isArchived","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,true,now())',
      [p.id, p.name, p.slug, p.description, "", p.specifications, p.salePrice]
    );
    await db.query(
      'INSERT INTO "ProductCategory" ("productId","categoryId") VALUES ($1,$2)',
      [p.id, category.id]
    );
    for (const [position, im] of p.images.entries()) {
      await db.query(
        'UPDATE "ProductMediaAsset" SET state=' +
          "'ATTACHED'" +
          ',"expiresAt"=NULL,"updatedAt"=now() WHERE path=$1',
        [im.path]
      );
      await db.query(
        'INSERT INTO "ProductImage" (id,"productId",path,alt,position) VALUES ($1,$2,$3,$4,$5)',
        [
          stableId(p.slug + ":image:" + position),
          p.id,
          im.path,
          im.alt,
          position,
        ]
      );
    }
    for (const v of p.variants) {
      await db.query(
        'INSERT INTO "ProductVariant" (id,"productId",size,color,"colorHex",sku,stock,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
        [v.id, p.id, v.size, v.color, v.colorHex, v.sku, v.stock]
      );
    }
    const saved = (
      await db.query(
        'SELECT "salePrice"::text FROM "Product" WHERE id=$1 AND "isArchived"=true',
        [p.id]
      )
    ).rows[0];
    assert.equal(saved.salePrice, p.salePrice);
    const actualVariants = (
      await db.query(
        'SELECT sku,size,color,stock FROM "ProductVariant" WHERE "productId"=$1 ORDER BY sku',
        [p.id]
      )
    ).rows;
    assert.deepEqual(
      actualVariants,
      p.variants
        .map(({ sku, size, color, stock }) => ({ sku, size, color, stock }))
        .sort((a, b) => a.sku.localeCompare(b.sku))
    );
    assert.equal(
      Number(
        (
          await db.query(
            'SELECT count(*) FROM "ProductImage" WHERE "productId"=$1',
            [p.id]
          )
        ).rows[0].count
      ),
      p.images.length
    );
    created.push(p.id);
  }
  if (apply && created.length) {
    await db.query(
      'UPDATE "Product" SET "isArchived"=false,"version"="version"+1,"updatedAt"=now() WHERE id=ANY($1::text[])',
      [created]
    );
  }
  const summary = (
    await db.query(
      'SELECT p.slug,p."salePrice"::text,p."isArchived",v.sku,v.size,v.color,v.stock FROM "Product" p JOIN "ProductVariant" v ON v."productId"=p.id WHERE p.id=ANY($1::text[]) ORDER BY p.slug,v.sku',
      [manifest.products.map((p) => p.id)]
    )
  ).rows;
  await db.query(apply ? "COMMIT" : "ROLLBACK");
  transaction = false;
  console.log(
    JSON.stringify(
      {
        created: created.length,
        skipped: skipped.length,
        variants: summary.length,
        totalStock: summary.reduce((n, v) => n + v.stock, 0),
        items: summary,
      },
      null,
      2
    )
  );
} catch (error) {
  if (transaction) await db.query("ROLLBACK");
  // Do not print connection details or credentials.
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : `Import failed: ${error.code || error.name}`
  );
  process.exitCode = 1;
} finally {
  await db.end();
  if (registry) await registry.end();
}
