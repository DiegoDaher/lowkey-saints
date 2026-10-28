import "dotenv/config";
import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";
const runtime = new URL(process.env.DATABASE_URL);
const direct = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL);
if (!process.env.DIRECT_URL) {
  if (!direct.hostname.endsWith(".pooler.supabase.com"))
    throw new Error("Configure DIRECT_URL explicitly");
  direct.port = "5432";
  direct.searchParams.delete("pgbouncer");
}
async function probe(url) {
  const c = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 10000,
  });
  try {
    await c.connect();
    await c.query("BEGIN READ ONLY");
    await c.query("SELECT 1");
    await c.query("ROLLBACK");
  } finally {
    await c.end();
  }
}
try {
  let changed = !process.env.DIRECT_URL;
  try {
    await probe(direct);
  } catch (e) {
    if (
      e.code !== "28P01" ||
      direct.hostname !== runtime.hostname ||
      direct.username !== runtime.username ||
      direct.pathname !== runtime.pathname
    )
      throw e;
    direct.password = runtime.password;
    await probe(direct);
    changed = true;
  }
  if (changed) {
    const text = await readFile(".env", "utf8");
    const line = "DIRECT_URL=" + JSON.stringify(direct.toString());
    await writeFile(
      ".env",
      /^DIRECT_URL=.*$/m.test(text)
        ? text.replace(/^DIRECT_URL=.*$/m, line)
        : text + "\n" + line + "\n"
    );
  }
  console.log("Migration session connection verified");
} catch (e) {
  console.error(
    e.code || e.name,
    "Session connection failed (credentials omitted)"
  );
  process.exitCode = 1;
}
