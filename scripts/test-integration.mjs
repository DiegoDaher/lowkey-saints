import pg from "pg";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const base =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:local-test-only@127.0.0.1:55439/postgres";
const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Tests require a local database");
url.pathname = "/postgres";
const admin = new pg.Client({ connectionString: url.toString() });
await admin.connect();
const name = "lowkey_test_" + randomBytes(6).toString("hex");
try {
  await admin.query("CREATE DATABASE " + name);
  url.pathname = "/" + name;
  const env = { ...process.env, TEST_DATABASE_URL: url.toString() };
  for (const [command, args] of [
    [process.execPath, ["scripts/test-database.mjs"]],
    [
      process.execPath,
      [
        "node_modules/deno/bin.cjs",
        "test",
        "--allow-env",
        "--allow-net",
        "--allow-read",
        "--allow-sys",
        "--config",
        "supabase/functions/deno.json",
        "tests/integration.ts",
      ],
    ],
  ]) {
    const r = spawnSync(command, args, { env, stdio: "inherit" });
    if (r.status !== 0) throw new Error("Integration checks failed");
  }
} finally {
  await admin.query("DROP DATABASE " + name + " WITH (FORCE)");
  await admin.end();
}
