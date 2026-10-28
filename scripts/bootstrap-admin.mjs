import "dotenv/config";
import pg from "pg";
const email = process.argv[2];
if (!email || !email.includes("@"))
  throw new Error("Usage: node scripts/bootstrap-admin.mjs email");
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query('LOCK TABLE "AdminProfile" IN EXCLUSIVE MODE');
  const existing = await client.query(
    "SELECT id FROM \"AdminProfile\" WHERE role='ADMIN' AND active=true"
  );
  const user = await client.query(
    "SELECT id FROM auth.users WHERE lower(email)=lower($1)",
    [email]
  );
  if (user.rows.length !== 1)
    throw new Error("Exactly one existing Auth user is required");
  if (existing.rows.some((r) => r.id !== user.rows[0].id))
    throw new Error("An ADMIN already exists; use the administration panel");
  await client.query(
    'INSERT INTO "AdminProfile"(id,role,active,"updatedAt") VALUES ($1,\'ADMIN\',true,now()) ON CONFLICT(id) DO UPDATE SET role=\'ADMIN\',active=true,"updatedAt"=now()',
    [user.rows[0].id]
  );
  await client.query("COMMIT");
  console.log("ADMIN assigned to the requested existing Auth account");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
