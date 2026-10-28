import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
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
  for (const folder of (
    await readdir("prisma/migrations", { withFileTypes: true })
  )
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await client.query(
      await readFile(
        "prisma/migrations/" + folder.name + "/migration.sql",
        "utf8"
      )
    );
  await client.query("COMMIT");
  console.log("All migrations applied to disposable test database");
} finally {
  await client.end();
}
