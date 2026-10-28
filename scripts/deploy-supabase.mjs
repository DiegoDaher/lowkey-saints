import "dotenv/config";
import { spawnSync } from "node:child_process";
import { writeFile, unlink, appendFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";
const required = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "APP_DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length)
  throw new Error("Missing configuration: " + missing.join(", "));

const expected = "https://" + process.env.SUPABASE_PROJECT_REF + ".supabase.co";
if (process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "") !== expected)
  throw new Error("Project URL and reference do not match");
function cli(args) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/supabase/dist/supabase.js", ...args],
    { stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error("Supabase command failed");
}
const secrets = {
  APP_DATABASE_URL: process.env.APP_DATABASE_URL,
  WHATSAPP_PHONE: process.env.WHATSAPP_PHONE,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  SITE_URL: process.env.SITE_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
  JOB_SECRET: process.env.JOB_SECRET || randomBytes(32).toString("hex"),
  RATE_LIMIT_SECRET:
    process.env.RATE_LIMIT_SECRET || randomBytes(32).toString("hex"),
};
const secretFile = ".env.supabase-deploy";
await writeFile(
  secretFile,
  Object.entries(secrets)
    .filter(([, v]) => v)
    .map(([k, v]) => k + "=" + JSON.stringify(v))
    .join("\n")
);
try {
  cli([
    "secrets",
    "set",
    "--project-ref",
    process.env.SUPABASE_PROJECT_REF,
    "--env-file",
    secretFile,
  ]);
  cli([
    "functions",
    "deploy",
    "api",
    "--project-ref",
    process.env.SUPABASE_PROJECT_REF,
  ]);
  cli([
    "functions",
    "deploy",
    "jobs",
    "--project-ref",
    process.env.SUPABASE_PROJECT_REF,
  ]);
} finally {
  await unlink(secretFile);
}
for (const key of ["JOB_SECRET", "RATE_LIMIT_SECRET"])
  if (!process.env[key])
    await appendFile(
      ".env",
      "\n" + key + "=" + JSON.stringify(secrets[key]) + "\n"
    );
const catalog = await fetch(expected + "/functions/v1/api/v1/categories", {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
});
if (!catalog.ok) throw new Error("API smoke check failed; cron not activated");
const probe = await fetch(expected + "/functions/v1/jobs", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + secrets.JOB_SECRET,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ probe: true }),
});
if (!probe.ok)
  throw new Error("Edge transaction probe failed; cron not activated");
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();
try {
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_cron");
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_net");
  for (const [name, value] of [
    ["lowkey_jobs_url", expected + "/functions/v1/jobs"],
    ["lowkey_job_secret", secrets.JOB_SECRET],
  ]) {
    const old = await client.query(
      "SELECT id FROM vault.secrets WHERE name=$1",
      [name]
    );
    if (old.rows.length)
      await client.query("SELECT vault.update_secret($1,$2)", [
        old.rows[0].id,
        value,
      ]);
    else await client.query("SELECT vault.create_secret($1,$2)", [value, name]);
  }
  await client.query(
    "SELECT cron.schedule('lowkey-jobs','* * * * *','SELECT public.lowkey_run_jobs()')"
  );
  console.log("Functions deployed; API checked; cron enabled");
} finally {
  await client.end();
}
