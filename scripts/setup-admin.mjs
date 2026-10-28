import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password)
  throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env");
const auth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
const sql = new pg.Client({ connectionString: process.env.DIRECT_URL });
await sql.connect();
let createdId;
try {
  await sql.query("BEGIN");
  await sql.query('LOCK TABLE "AdminProfile" IN EXCLUSIVE MODE');
  const admins = await sql.query(
    "SELECT id FROM \"AdminProfile\" WHERE role='ADMIN' AND active"
  );
  const existing = await sql.query(
    "SELECT id FROM auth.users WHERE lower(email)=$1",
    [email]
  );
  if (admins.rows.some((a) => a.id !== existing.rows[0]?.id))
    throw new Error("Another ADMIN exists; use the panel to manage roles");
  let userId = existing.rows[0]?.id;
  if (!userId) {
    const { data, error } = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error)
      throw new Error("Auth user creation failed (HTTP " + error.status + ")");
    userId = data.user.id;
    createdId = userId;
  }
  await sql.query(
    'INSERT INTO "AdminProfile" (id,role,active,"updatedAt") VALUES ($1,\'ADMIN\',true,now()) ON CONFLICT(id) DO UPDATE SET role=\'ADMIN\',active=true,"updatedAt"=now()',
    [userId]
  );
  await sql.query("COMMIT");
  createdId = undefined;
  console.log("Requested ADMIN account configured; no invitation sent");
} catch (e) {
  await sql.query("ROLLBACK");
  if (createdId) await auth.auth.admin.deleteUser(createdId);
  throw e;
} finally {
  await sql.end();
}
