import "dotenv/config";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { postgresTlsConfig } from "../supabase/functions/_shared/postgres-tls.mjs";
const phase = process.argv[2] === "before" ? "before" : "after";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = new pg.Client({
  ...postgresTlsConfig(process.env.DIRECT_URL),
  connectionTimeoutMillis: 10000,
});
const report = { timestamp: new Date().toISOString(), phase, checks: [] };
let userId;
try {
  await sql.connect();
  const email = "tls-test-" + randomUUID() + "@example.invalid";
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  await sql.query(
    'INSERT INTO "AdminProfile" (id,role,active,"createdAt","updatedAt") VALUES ($1,\'ADMIN\',true,now(),now())',
    [userId]
  );
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  const health = await fetch(url + "/functions/v1/api/v1/admin/health", {
    headers: {
      apikey: key,
      Authorization: "Bearer " + session.data.session.access_token,
    },
    signal: AbortSignal.timeout(20000),
  });
  report.checks.push({
    name: "API Prisma desde Edge",
    status: health.status,
    response: await health.json(),
  });
  if (!process.env.JOB_SECRET)
    throw new Error("Missing JOB_SECRET for read-only worker probe");
  const jobs = await fetch(url + "/functions/v1/jobs", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.JOB_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ probe: true }),
    signal: AbortSignal.timeout(20000),
  });
  report.checks.push({
    name: "jobs Prisma desde Edge, solo probe",
    status: jobs.status,
    response: await jobs.json(),
  });
  await client.auth.signOut();
} catch (e) {
  report.error = e.code || e.name;
  process.exitCode = 1;
} finally {
  if (userId) {
    await sql.query('DELETE FROM "AdminProfile" WHERE id=$1', [userId]);
    const deleted = await admin.auth.admin.deleteUser(userId);
    report.testAccountDeleted = !deleted.error;
  }
  await sql.end();
}
report.passed =
  report.checks.length === 2 &&
  report.checks.every((check) => check.status === 200) &&
  (phase === "before" ||
    (report.checks[0].response.postgresTls?.ssl === true &&
      report.checks[1].response.transaction?.[0]?.ssl === true));
await writeFile(
  "docs/evidencias/seguridad-apis/tls-edge-" + phase + ".json",
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report));
if (!report.passed) process.exitCode = 1;
