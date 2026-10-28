import "dotenv/config";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";
if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL required");
if (process.env.APP_DATABASE_URL) {
  console.log("Runtime credentials already configured; no rotation performed");
  process.exit(0);
}
const admin = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await admin.connect();
  const password = randomBytes(32).toString("hex");
  await admin.query("ALTER ROLE lowkey_api LOGIN PASSWORD '" + password + "'");
  const url = new URL(process.env.DATABASE_URL);
  const username = decodeURIComponent(url.username);
  const suffix = username.startsWith("postgres.")
    ? username.slice("postgres".length)
    : "";
  url.username = "lowkey_api" + suffix;
  url.password = password;
  url.searchParams.delete("pgbouncer");
  const probe = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 10000,
  });
  try {
    await probe.connect();
    await probe.query('SELECT 1 FROM public."Category" LIMIT 1');
  } finally {
    await probe.end();
  }
  await appendFile(
    ".env",
    "\nAPP_DATABASE_URL=" + JSON.stringify(url.toString()) + "\n"
  );
  console.log(
    "Runtime login provisioned and verified; credentials saved only to .env"
  );
} finally {
  await admin.end();
}
