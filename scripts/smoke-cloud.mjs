import "dotenv/config";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { randomUUID, randomBytes } from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !process.env.SUPABASE_SECRET_KEY)
  throw new Error("Supabase configuration missing");
const auth = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = new pg.Client({ connectionString: process.env.DIRECT_URL });
await sql.connect();
const users = [],
  products = [],
  orders = [];
let variantId;
async function request(path, method = "GET", data, token) {
  const response = await fetch(url + "/functions/v1/api/v1" + path, {
    method,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
try {
  const sessions = {};
  for (const role of ["ADMIN", "STAFF", "NONE"]) {
    const email = "lowkey-smoke-" + randomUUID() + "@example.com";
    const password = randomBytes(24).toString("base64url") + "aA1!";
    const { data, error } = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error)
      throw new Error("Could not create smoke-test user: " + error.status);
    users.push(data.user.id);
    if (role !== "NONE")
      await sql.query(
        'INSERT INTO "AdminProfile"(id,role,"updatedAt") VALUES ($1,$2,now())',
        [data.user.id, role]
      );
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error("Smoke sign-in failed");
    sessions[role] = login.data.session.access_token;
  }
  assert.equal((await request("/admin/me")).status, 401);
  assert.equal(
    (await request("/admin/me", "GET", undefined, sessions.NONE)).status,
    403
  );
  assert.equal(
    (await request("/admin/finances", "GET", undefined, sessions.STAFF)).status,
    403
  );
  const categories = await request("/categories");
  assert.equal(categories.status, 200);
  assert.ok(categories.body.length >= 4);
  const slug = "smoke-" + randomUUID();
  const product = await request(
    "/admin/products",
    "POST",
    {
      name: "Temporary smoke product",
      slug,
      description: "Test",
      materials: "Cotton",
      specifications: "Test",
      salePrice: "100.25",
      modelHeightCm: null,
      modelSize: null,
      categoryIds: [categories.body[0].id],
      images: [],
      measurements: [],
      complementaryIds: [],
    },
    sessions.STAFF
  );
  assert.equal(product.status, 201, JSON.stringify(product.body));
  products.push(product.body.id);
  const variant = await request(
    "/admin/variants",
    "POST",
    {
      productId: product.body.id,
      size: "M",
      color: "Black",
      colorHex: "#000000",
      sku: slug,
    },
    sessions.STAFF
  );
  assert.equal(variant.status, 201);
  variantId = variant.body.id;
  assert.equal(
    (
      await request(
        "/admin/stock",
        "PATCH",
        { changes: [{ id: variantId, version: 0, stock: 2 }] },
        sessions.STAFF
      )
    ).status,
    200
  );
  assert.equal(
    (
      await request(
        "/admin/finances",
        "PUT",
        { productId: product.body.id, costPrice: "30.00" },
        sessions.ADMIN
      )
    ).status,
    200
  );
  const publicProduct = await request("/products/" + slug);
  assert.equal(publicProduct.status, 200);
  assert.ok(!JSON.stringify(publicProduct.body).includes("costPrice"));
  assert.ok(!JSON.stringify(publicProduct.body).includes("financial"));
  const payload = {
    idempotencyKey: randomUUID(),
    clientName: "Smoke test",
    clientPhone: "5555555555",
    items: [{ variantId, quantity: 1 }],
  };
  assert.equal(
    (await request("/orders", "POST", { ...payload, totalAmount: "0" })).status,
    400
  );
  const order = await request("/orders", "POST", payload);
  assert.equal(order.status, 201, JSON.stringify(order.body));
  orders.push(order.body.id);
  assert.equal(Number(order.body.totalAmount), 100.25);
  const replay = await request("/orders", "POST", payload);
  assert.equal(replay.body.id, order.body.id);
  assert.equal(
    (
      await request(
        "/admin/orders/" + order.body.id,
        "PATCH",
        { status: "CONFIRMED" },
        sessions.STAFF
      )
    ).status,
    200
  );
  assert.equal(
    (
      await request(
        "/admin/orders/" + order.body.id,
        "PATCH",
        { status: "CANCELLED" },
        sessions.STAFF
      )
    ).status,
    409
  );
  assert.equal(
    (
      await request(
        "/admin/orders/" + order.body.id,
        "PATCH",
        { status: "SHIPPED" },
        sessions.STAFF
      )
    ).status,
    200
  );
  for (const token of [undefined, sessions.STAFF]) {
    const response = await fetch(url + "/rest/v1/ProductCost?select=*", {
      headers: {
        apikey: key,
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
    });
    assert.ok(
      response.status === 401 || response.status === 403,
      "Direct financial table must be denied"
    );
  }
  console.log(
    "Cloud smoke passed: anonymous/unassigned/STAFF/ADMIN, catalog, costs, order idempotency and state machine"
  );
} finally {
  // Delete only IDs created by this test, preserving every pre-existing row.
  if (orders.length) {
    await sql.query('DELETE FROM "OrderItem" WHERE "orderId"=ANY($1::text[])', [
      orders,
    ]);
    await sql.query('DELETE FROM "Order" WHERE id=ANY($1::text[])', [orders]);
  }
  if (products.length) {
    await sql.query(
      'DELETE FROM "ProductCost" WHERE "productId"=ANY($1::text[])',
      [products]
    );
    await sql.query(
      'DELETE FROM "ProductCategory" WHERE "productId"=ANY($1::text[])',
      [products]
    );
    await sql.query(
      'DELETE FROM "ProductVariant" WHERE "productId"=ANY($1::text[])',
      [products]
    );
    await sql.query('DELETE FROM "Product" WHERE id=ANY($1::text[])', [
      products,
    ]);
  }
  for (const id of users) {
    const { error } = await auth.auth.admin.deleteUser(id);
    if (error) console.error("Test account cleanup failed:", id);
  }
  await sql.end();
}
