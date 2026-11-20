// Local browser-test Auth stub. Never used by the application or deployment.
import { createServer } from "node:http";
const user = {
  id: "10000000-0000-4000-8000-000000000099",
  aud: "authenticated",
  role: "authenticated",
  email: "operator@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-11-11T00:00:00Z",
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const usedRecovery = new Set();
const revoked = new Set();
const tokenFor = (email) =>
  `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, email, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 })}.test-signature`;
const sessionFor = (email) => ({
  access_token: tokenFor(email),
  refresh_token: email,
  expires_in: 86400,
  token_type: "bearer",
  user: { ...user, email },
});
const categoryId = "20000000-0000-4000-8000-000000000001";
function seedInventory() {
  return [1, 2].map((n) => ({
    id: `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: `Prenda ${n}`,
    slug: `prenda-${n}`,
    description: "",
    materials: "",
    specifications: "",
    salePrice: "100.00",
    isArchived: false,
    version: 0,
    modelHeightCm: null,
    modelSize: null,
    categories: [
      { category: { id: categoryId, name: "Camisetas", slug: "camisetas" } },
    ],
    images: [],
    measurements: [],
    complements: [],
    variants: [
      {
        id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        size: "M",
        color: "Negro",
        colorHex: "#222222",
        sku: `SKU-${n}`,
        stock: 3,
        version: 0,
        isArchived: false,
      },
    ],
  }));
}
let inventory = seedInventory();
let financialSettings = { lowMarginThreshold: "30.00", version: 0 };
const costs = new Map();
let stockRequests = [];
const media = new Map();
let mediaRequests = [];
let mediaDeletes = [];
createServer(async (req, res) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    req.headers.origin || "http://localhost:3102"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  let body = {};
  let rawBody = Buffer.alloc(0);
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    rawBody = Buffer.concat(parts);
    try {
      body = JSON.parse(rawBody.toString());
    } catch {
      /* Empty logout body. */
    }
  }
  let email;
  try {
    email = JSON.parse(
      Buffer.from(
        req.headers.authorization.split(".")[1],
        "base64url"
      ).toString()
    ).email;
  } catch {
    /* Anonymous request. */
  }
  if (req.url.startsWith("/auth/v1/token")) {
    if (body.password === "wrong-password") {
      res.writeHead(400).end(
        JSON.stringify({
          message: "Invalid credentials",
          code: "invalid_credentials",
        })
      );
      return;
    }
    res.end(JSON.stringify(sessionFor(body.email || body.refresh_token)));
  } else if (req.url === "/auth/v1/recover") {
    res.end("{}");
  } else if (req.url === "/auth/v1/verify") {
    if (
      !body.token_hash?.startsWith("valid-") ||
      usedRecovery.has(body.token_hash)
    ) {
      res
        .writeHead(403)
        .end(JSON.stringify({ message: "Expired token", code: "otp_expired" }));
    } else {
      usedRecovery.add(body.token_hash);
      res.end(JSON.stringify(sessionFor("operator@example.test")));
    }
  } else if (req.url.startsWith("/auth/v1/logout")) {
    res.writeHead(204).end();
  } else if (
    req.url.startsWith("/auth/v1/user") &&
    email &&
    !revoked.has(email)
  ) {
    if (req.method === "PUT" && body.current_password === "wrong-password") {
      res
        .writeHead(400)
        .end(
          JSON.stringify({
            message: "Invalid current password",
            code: "invalid_credentials",
          })
        );
      return;
    }
    res.end(JSON.stringify({ ...user, email }));
  } else if (req.url === "/test/revoke" && req.method === "POST") {
    revoked.add(body.email);
    res.end("{}");
  } else if (
    req.url === "/functions/v1/api/v1/admin/me" &&
    email &&
    !revoked.has(email)
  ) {
    if (["inactive@example.test", "unassigned@example.test"].includes(email)) {
      res.writeHead(403).end(JSON.stringify({ error: "No tienes permiso" }));
    } else if (email === "unavailable@example.test") {
      res.writeHead(503).end(JSON.stringify({ error: "Unavailable" }));
    } else {
      res.end(
        JSON.stringify({
          id: user.id,
          active: true,
          role: ["admin@example.test", "inventory-admin@example.test"].includes(
            email
          )
            ? "ADMIN"
            : "OPERATOR",
        })
      );
    }
  } else if (req.url === "/test/inventory/reset" && req.method === "POST") {
    inventory = seedInventory();
    financialSettings = { lowMarginThreshold: "30.00", version: 0 };
    costs.clear();
    stockRequests = [];
    media.clear();
    mediaRequests = [];
    mediaDeletes = [];
    res.end("{}");
  } else if (req.url === "/test/inventory/state") {
    res.end(
      JSON.stringify({ inventory, stockRequests, mediaRequests, mediaDeletes })
    );
  } else if (req.url === "/test/inventory/conflict" && req.method === "POST") {
    inventory[1].variants[0].version++;
    res.end("{}");
  } else if (
    email?.startsWith("inventory-") &&
    req.url.startsWith("/functions/v1/api/v1/admin/")
  ) {
    const url = new URL(req.url, "http://fixture");
    const path = url.pathname.replace("/functions/v1/api/v1", "");
    const fail = (status, error) =>
      res.writeHead(status).end(JSON.stringify({ error }));
    if (
      req.method !== "GET" &&
      path !== "/admin/stock" &&
      email !== "inventory-admin@example.test"
    ) {
      fail(403, "No tienes permiso");
      return;
    }
    if (path.startsWith("/admin/finances")) {
      if (email !== "inventory-admin@example.test") {
        fail(403, "No tienes permiso");
        return;
      }
      if (path === "/admin/finances/settings" && req.method === "PUT") {
        if (body.version !== financialSettings.version) {
          fail(409, "El umbral cambió. Recarga antes de guardar.");
          return;
        }
        financialSettings = {
          lowMarginThreshold: Number(body.lowMarginThreshold).toFixed(2),
          version: financialSettings.version + 1,
        };
        res.end(JSON.stringify(financialSettings));
        return;
      }
      if (
        path.startsWith("/admin/finances/products/") &&
        req.method === "PATCH"
      ) {
        const p = inventory.find((p) => p.id === path.split("/").at(-1));
        if (!p) {
          fail(404, "Producto no encontrado");
          return;
        }
        if (body.version !== p.version) {
          fail(409, "El producto cambió. Recarga antes de guardar.");
          return;
        }
        p.salePrice = body.salePrice;
        p.version++;
        costs.set(p.id, body.costPrice);
        res.end("{}");
        return;
      }
      if (path === "/admin/finances/dashboard") {
        const rows = inventory
          .filter(
            (p) =>
              (!url.searchParams.get("q") ||
                p.name.includes(url.searchParams.get("q"))) &&
              (url.searchParams.get("state") === "all" ||
                p.isArchived === (url.searchParams.get("state") === "archived"))
          )
          .map((p) => {
            const costPrice = costs.get(p.id) ?? null;
            const amount =
              costPrice === null
                ? null
                : Number(p.salePrice) - Number(costPrice);
            const percent =
              amount === null || Number(p.salePrice) === 0
                ? null
                : (amount / Number(p.salePrice)) * 100;
            return {
              id: p.id,
              name: p.name,
              version: p.version,
              isArchived: p.isArchived,
              salePrice: p.salePrice,
              costPrice,
              amount: amount?.toFixed(2) ?? null,
              percent: percent?.toFixed(2) ?? null,
              status:
                amount === null
                  ? "missing"
                  : amount < 0
                    ? "negative"
                    : percent === null
                      ? "undefined"
                      : percent < Number(financialSettings.lowMarginThreshold)
                        ? "low"
                        : "healthy",
            };
          });
        const eligible = rows.filter((r) => r.percent !== null);
        res.end(
          JSON.stringify({
            items: rows,
            total: rows.length,
            settings: financialSettings,
            kpis: {
              averageMargin: eligible.length
                ? (
                    eligible.reduce((s, r) => s + Number(r.percent), 0) /
                    eligible.length
                  ).toFixed(2)
                : null,
              eligible: eligible.length,
              low: rows.filter((r) => r.status === "low").length,
              negative: rows.filter((r) => r.status === "negative").length,
              missing: rows.filter((r) => r.status === "missing").length,
            },
          })
        );
        return;
      }
    }
    if (path === "/admin/images" && req.method === "POST") {
      const id = crypto.randomUUID();
      const path = id + ".webp";
      const type = req.headers["content-type"];
      media.set(path, { bytes: rawBody, type });
      mediaRequests.push({ path, type, size: rawBody.length });
      res.writeHead(201).end(
        JSON.stringify({
          id,
          path,
          url:
            "http://127.0.0.1:55440/storage/v1/object/public/product-images/" +
            path,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        })
      );
    } else if (path.startsWith("/admin/images/") && req.method === "DELETE") {
      mediaDeletes.push(path.split("/").at(-1));
      res.writeHead(202).end('{"ok":true}');
    } else if (path === "/admin/stock" && req.method === "PATCH") {
      stockRequests.push(body);
      const variants = inventory.flatMap((p) => p.variants);
      if (
        body.changes.some(
          (c) => !variants.some((v) => v.id === c.id && v.version === c.version)
        )
      ) {
        fail(409, "El inventario cambió; recarga antes de guardar");
        return;
      }
      for (const c of body.changes) {
        const v = variants.find((v) => v.id === c.id);
        v.stock = c.stock;
        v.version++;
      }
      res.end('{"ok":true}');
    } else if (path === "/admin/products" && req.method === "GET") {
      const items = inventory.filter(
        (p) =>
          (!url.searchParams.get("q") ||
            p.name.includes(url.searchParams.get("q"))) &&
          (url.searchParams.get("state") === "archived"
            ? p.isArchived
            : url.searchParams.get("state") === "active"
              ? !p.isArchived
              : true)
      );
      res.end(JSON.stringify({ items, total: items.length }));
    } else if (path === "/admin/products" && req.method === "POST") {
      const p = {
        ...body,
        id: crypto.randomUUID(),
        version: 0,
        variants: [],
        categories: [{ category: { id: categoryId, name: "Camisetas" } }],
        complements: [],
      };
      p.images = (p.images || []).map((im, position) => ({
        ...im,
        id: im.path,
        position,
        url:
          "http://127.0.0.1:55440/storage/v1/object/public/product-images/" +
          im.path,
      }));
      inventory.push(p);
      res.end(JSON.stringify(p));
    } else if (path.startsWith("/admin/products/")) {
      const p = inventory.find((p) => p.id === path.split("/").at(-1));
      if (!p) {
        fail(404, "No encontrado");
        return;
      }
      if (req.method !== "GET") {
        if (p.version !== body.version) {
          fail(409, "El producto cambió");
          return;
        }
        Object.assign(p, body, { version: p.version + 1 });
        if (body.images)
          p.images = body.images.map((im, position) => ({
            ...im,
            id: im.path,
            position,
            url:
              "http://127.0.0.1:55440/storage/v1/object/public/product-images/" +
              im.path,
          }));
      }
      res.end(JSON.stringify(p));
    } else if (path === "/admin/variants" && req.method === "POST") {
      const p = inventory.find((p) => p.id === body.productId);
      p.variants.push({
        ...body,
        id: crypto.randomUUID(),
        stock: 0,
        version: 0,
        isArchived: false,
      });
      res.end('{"ok":true}');
    } else if (path.startsWith("/admin/variants/")) {
      const v = inventory
        .flatMap((p) => p.variants)
        .find((v) => v.id === path.split("/").at(-1));
      Object.assign(v, body, { version: v.version + 1 });
      res.end('{"ok":true}');
    } else fail(404, "No encontrado");
  } else if (
    req.url.startsWith("/functions/v1/api/v1/admin/products") &&
    email
  ) {
    res.end(JSON.stringify({ items: [] }));
  } else if (req.url === "/functions/v1/api/v1/categories") {
    res.end(JSON.stringify([{ id: categoryId, name: "Camisetas" }]));
  } else if (req.url === "/functions/v1/api/v1/products/hoodie-prueba") {
    res.end(
      JSON.stringify({
        id: "hoodie",
        name: "Hoodie de prueba",
        slug: "hoodie-prueba",
        description: "Prenda de prueba",
        salePrice: "1999",
        images: [
          {
            id: "image",
            url: "/images/editorial/alo-coffee.webp",
            alt: "Hoodie café",
          },
        ],
        categories: [{ category: { name: "Tops" } }],
        measurements: [],
        variants: [
          {
            id: "variant",
            size: "M",
            color: "Café",
            colorHex: "#70513e",
            stock: 3,
          },
        ],
      })
    );
  } else if (req.url.startsWith("/storage/v1/object/public/product-images/")) {
    const object = media.get(req.url.split("/").at(-1));
    if (!object) res.writeHead(404).end();
    else {
      res.setHeader("Content-Type", object.type);
      res.end(object.bytes);
    }
  } else if (req.url === "/health") {
    res.end("{}");
  } else {
    res.writeHead(401).end(JSON.stringify({ message: "Invalid test session" }));
  }
}).listen(55440, "127.0.0.1");
