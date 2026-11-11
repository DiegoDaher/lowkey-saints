import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import tls from "node:tls";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const dir = "docs/evidencias/seguridad-apis";
await mkdir(dir, { recursive: true });
const report = {
  timestamp: new Date().toISOString(),
  environment: "Supabase existente",
  commitBase: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  checks: [],
};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const record = (name, detail) => {
  report.checks.push({ name, ...detail });
  console.log(JSON.stringify({ name, ...detail }));
};
async function api(path, token) {
  const res = await fetch(url + "/functions/v1/api/v1" + path, {
    headers: {
      apikey: key,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, body: await res.json() };
}
try {
  const catalog = await api("/products");
  record("GET /functions/v1/api/v1/products", {
    status: catalog.status,
    response:
      catalog.status === 200
        ? {
            page: catalog.body.page,
            total: catalog.body.total,
            items: catalog.body.items
              ?.slice(0, 1)
              .map((p) => ({ name: p.name, salePrice: p.salePrice })),
          }
        : { error: catalog.body.error },
  });
  const anonymous = await api("/admin/finances");
  record("Finanzas sin sesión", {
    status: anonymous.status,
    response: anonymous.body,
    expected: 401,
  });
} catch (e) {
  record("API pública", {
    blocked: true,
    error: e.cause?.code || e.code || e.name,
  });
}
try {
  const host = new URL(url).hostname;
  const result = await new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: true },
      () => {
        const cert = socket.getPeerCertificate();
        resolve({
          authorized: socket.authorized,
          protocol: socket.getProtocol(),
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          issuer: cert.issuer?.O,
        });
        socket.end();
      }
    );
    socket.setTimeout(15000, () => socket.destroy(new Error("TLS timeout")));
    socket.on("error", reject);
  });
  record("TLS Supabase HTTPS", result);
} catch (e) {
  record("TLS Supabase HTTPS", { blocked: true, error: e.code || e.name });
}
const sql = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 10000,
});
const auth = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = [];
try {
  await sql.connect();
  const migrations = await sql.query(
    'SELECT migration_name, finished_at IS NOT NULL AS applied FROM "_prisma_migrations" ORDER BY migration_name'
  );
  record("Migraciones remotas", { rows: migrations.rows });
  const appDb = new pg.Client({
    connectionString: process.env.APP_DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  try {
    await appDb.connect();
    const ssl = await appDb.query(
      "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    );
    const stream = appDb.connection.stream;
    record("Conexión APP_DATABASE_URL", {
      server: ssl.rows,
      clientEncrypted: Boolean(stream.encrypted),
      clientAuthorized: stream.authorized === true,
    });
  } finally {
    await appDb.end();
  }
  for (const role of ["ADMIN", "STAFF"]) {
    const email = "practice-" + randomUUID() + "@example.invalid";
    const password = randomBytes(24).toString("base64url");
    const created = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    const id = created.data.user.id;
    users.push(id);
    await sql.query(
      'INSERT INTO "AdminProfile" (id, role, active, "createdAt", "updatedAt") VALUES ($1,$2,true,now(),now())',
      [id, role]
    );
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const session = await client.auth.signInWithPassword({ email, password });
    if (session.error) throw session.error;
    record("POST /auth/v1/token?grant_type=password " + role, {
      status: 200,
      request: { email: "[CUENTA TEMPORAL]", password: "[OCULTO]" },
      response: {
        token_type: session.data.session.token_type,
        access_token: "[OCULTO]",
        refresh_token: "[OCULTO]",
        user: "[OCULTO]",
      },
    });
    const finances = await api(
      "/admin/finances",
      session.data.session.access_token
    );
    record("GET finanzas " + role, {
      status: finances.status,
      expected: role === "ADMIN" ? 200 : 403,
      response:
        role === "ADMIN"
          ? {
              records: Array.isArray(finances.body)
                ? finances.body.length
                : null,
              content: "[DATOS FINANCIEROS OMITIDOS]",
            }
          : finances.body,
    });
    if (role === "ADMIN") {
      const imageHeaders = {
        apikey: key,
        Authorization: "Bearer " + session.data.session.access_token,
        "Content-Type": "image/png",
      };
      const invalid = await fetch(url + "/functions/v1/api/v1/admin/images", {
        method: "POST",
        headers: imageHeaders,
        body: new Uint8Array([0, 1, 2]),
      });
      record("Imagen con firma inválida", {
        status: invalid.status,
        expected: 400,
      });
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
        "base64"
      );
      const valid = await fetch(url + "/functions/v1/api/v1/admin/images", {
        method: "POST",
        headers: imageHeaders,
        body: png,
      });
      const uploaded = await valid.json();
      record("PNG de prueba válido", { status: valid.status, expected: 201 });
      if (valid.status === 201 && uploaded.path) {
        const removed = await auth.storage
          .from("product-images")
          .remove([uploaded.path]);
        record("Limpieza PNG de prueba", { success: !removed.error });
      }
    }
    await client.auth.signOut();
  }
} catch (e) {
  record("Base de datos y autorización", {
    blocked: true,
    error: e.code || e.name,
  });
} finally {
  for (const id of users) {
    try {
      await sql.query('DELETE FROM "AdminProfile" WHERE id=$1', [id]);
      const result = await auth.auth.admin.deleteUser(id);
      if (result.error) throw result.error;
    } catch (e) {
      record("Limpieza de cuenta temporal", {
        blocked: true,
        error: e.code || e.name,
      });
    }
  }
  await sql.end().catch(() => {});
  await writeFile(dir + "/cloud.json", JSON.stringify(report, null, 2) + "\n");
}
