import "dotenv/config";
import pg from "pg";
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Missing database connection");
const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const tables = await client.query(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log(JSON.stringify(tables.rows));
  const migrations = await client.query(
    "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present"
  );
  console.log(JSON.stringify(migrations.rows));
  await client.query("ROLLBACK");
} catch (e) {
  console.error(
    e.code || e.name,
    "Database inspection failed (credentials omitted)"
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
