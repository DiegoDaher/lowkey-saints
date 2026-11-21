import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { postgresTlsConfig } from "../supabase/functions/_shared/postgres-tls.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const checkAdministration = process.argv.includes("--administration");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, options);
const client = createClient(url, key, options);
const sql = new pg.Client({
  ...postgresTlsConfig(process.env.DIRECT_URL),
  connectionTimeoutMillis: 10000,
});
let userId;
try {
  await sql.connect();
  const email = `order-check-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString("base64url") + "aA1!";
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error)
    throw new Error(`Test account creation failed: ${created.error.status}`);
  userId = created.data.user.id;
  await sql.query(
    'INSERT INTO "AdminProfile" (id,role,active,"createdAt","updatedAt") VALUES ($1,$2,true,now(),now())',
    [userId, checkAdministration ? "ADMIN" : "OPERATOR"]
  );
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw new Error(`Test login failed: ${login.error.status}`);
  async function get(path) {
    const response = await fetch(url + "/functions/v1/api/v1" + path, {
      headers: {
        apikey: key,
        Authorization: "Bearer " + login.data.session.access_token,
      },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(
      response.status,
      200,
      `GET ${path.replace(/orders\/[^/]+/, "orders/[id]")} status`
    );
    return response.json();
  }
  if (checkAdministration) {
    const users = await get("/admin/users?page=1");
    assert.ok(Array.isArray(users.users), "Users listing missing");
    console.log(JSON.stringify({ route: "/admin/users", status: 200 }));
    const dashboard = await get("/admin/finances/dashboard?page=1");
    assert.ok(dashboard && typeof dashboard === "object", "Dashboard missing");
    console.log(
      JSON.stringify({ route: "/admin/finances/dashboard", status: 200 })
    );
    await get("/admin/finances/settings");
    console.log(
      JSON.stringify({ route: "/admin/finances/settings", status: 200 })
    );
  }
  const orders = await get("/admin/orders?page=1");
  assert.ok(Array.isArray(orders));
  for (const order of orders) {
    assert.ok(
      Array.isArray(order.availableActions),
      "availableActions missing"
    );
    const history = await get(`/admin/orders/${order.id}/history`);
    assert.ok(Array.isArray(history), "History must be an array");
    console.log(
      JSON.stringify({
        historyStatus: 200,
        events: history.length,
        actionsPresent: true,
      })
    );
  }
  assert.ok(orders.length > 0, "No orders available to verify history");
  assert.ok(process.env.JOB_SECRET, "Missing job probe credential");
  const probe = await fetch(url + "/functions/v1/jobs", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.JOB_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ probe: true }),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(probe.status, 200, "Jobs database probe");
  console.log(
    JSON.stringify({ ordersChecked: orders.length, jobsProbe: probe.status })
  );
} catch (error) {
  console.error(error.name, error.message);
  process.exitCode = 1;
} finally {
  if (userId) {
    await client.auth.signOut();
    await sql.query('DELETE FROM "AdminProfile" WHERE id=$1', [userId]);
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) {
      console.error("Test account cleanup failed");
      process.exitCode = 1;
    } else console.log("Temporary test account deleted");
  }
  await sql.end();
}
