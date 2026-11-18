import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error("TEST_DATABASE_URL must point to a disposable database");
const parsed = new URL(url);
if (
  !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
  !parsed.pathname.includes("test")
)
  throw new Error("Only a local test database is accepted");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    "select tablename from pg_tables where schemaname='public'"
  );
  if (rows.length)
    throw new Error("Test database must be empty; use a fresh database");
  await client.query("BEGIN");
  const mediaProducts = [randomUUID(), randomUUID()];
  const mediaPath = randomUUID() + ".webp";
  for (const folder of (
    await readdir("prisma/migrations", { withFileTypes: true })
  )
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (folder.name === "202611180001_product_media") {
      // Historical paths may be shared, and must survive the new FK/backfill.
      for (const productId of mediaProducts) {
        await client.query(
          'INSERT INTO "Product" (id,name,slug,"salePrice","updatedAt") VALUES ($1,$1,$1,10,now())',
          [productId]
        );
        await client.query(
          'INSERT INTO "ProductImage" (id,"productId",path,alt,position) VALUES ($1,$2,$3,\'Historical\',0)',
          [randomUUID(), productId, mediaPath]
        );
      }
    }
    await client.query(
      await readFile(
        "prisma/migrations/" + folder.name + "/migration.sql",
        "utf8"
      )
    );
  }
  const historical = (
    await client.query(
      'SELECT a.state,count(i.id)::int AS references FROM "ProductMediaAsset" a JOIN "ProductImage" i ON i.path=a.path WHERE a.path=$1 GROUP BY a.state',
      [mediaPath]
    )
  ).rows;
  if (
    historical.length !== 1 ||
    historical[0].state !== "ATTACHED" ||
    historical[0].references !== 2
  )
    throw new Error("Historical media backfill lost references");
  await client.query('DELETE FROM "Product" WHERE id=ANY($1::text[])', [
    mediaProducts,
  ]);
  await client.query('DELETE FROM "ProductMediaAsset" WHERE path=$1', [
    mediaPath,
  ]);
  await client.query("COMMIT");
  console.log("All migrations applied to disposable test database");
} finally {
  await client.end();
}
