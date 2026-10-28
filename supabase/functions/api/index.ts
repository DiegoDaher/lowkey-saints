import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { db } from "../_shared/db.ts";
import { ShopService, productInclude } from "../_shared/service.ts";
import { AppError, hash, margin } from "../_shared/domain.ts";
import {
  orderInput,
  productInput,
  stockInput,
  subscriptionInput,
  statusInput,
  variantInput,
  money,
  id,
} from "../_shared/contracts.ts";
import { Prisma } from "../_shared/generated/prisma/client.ts";
const shop = new ShopService(db);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const auth = createClient(
  supabaseUrl,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const origins = (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());
function decorate<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, val) => {
    if (key === "images" && Array.isArray(val))
      return val.map((im) => ({
        ...im,
        url:
          supabaseUrl + "/storage/v1/object/public/product-images/" + im.path,
      }));
    return val;
  });
}
async function administrator(req: Request, onlyAdmin = false) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) throw new AppError(401, "Inicia sesión");
  const { data, error } = await auth.auth.getUser(bearer);
  if (error || !data.user) throw new AppError(401, "Sesión no válida");
  const profile = await db.adminProfile.findUnique({
    where: { id: data.user.id },
  });
  if (!profile?.active || (onlyAdmin && profile.role !== "ADMIN"))
    throw new AppError(403, "No tienes permiso");
  return profile;
}
async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 200000)
    throw new AppError(413, "Solicitud demasiado grande");
  const raw = await req.text();
  if (raw.length > 200000)
    throw new AppError(413, "Solicitud demasiado grande");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, "JSON inválido");
  }
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (origin && origins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] =
      "GET,POST,PUT,PATCH,DELETE,OPTIONS";
  }
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(decorate(data)), { status, headers });
  try {
    if (origin && !origins.includes(origin))
      throw new AppError(403, "Origen no autorizado");
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    const url = new URL(req.url);
    const route = url.pathname
      .replace(/^.*?\/api(?=\/|$)/, "")
      .replace(/\/$/, "");
    const method = req.method;
    const adminRoute = route.startsWith("/v1/admin");
    const profile = adminRoute
      ? await administrator(
          req,
          route.startsWith("/v1/admin/finances") ||
            route.startsWith("/v1/admin/roles")
        )
      : null;
    if (method !== "GET") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const secret = Deno.env.get("RATE_LIMIT_SECRET");
      if (!secret)
        throw new AppError(503, "Servicio pendiente de configuración");
      // Global budget also bounds requests with spoofed proxy headers.
      await shop.rateLimit("global-write", 1000);
      await shop.rateLimit(
        await hash(secret + ":" + (profile?.id || ip)),
        profile ? 120 : 20
      );
    }
    if (route === "/v1/categories" && method === "GET")
      return json(await db.category.findMany({ orderBy: { name: "asc" } }));
    if (
      (route === "/v1/products" || route === "/v1/admin/products") &&
      method === "GET"
    ) {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .parse(url.searchParams.get("page") || 1);
      const take = 24;
      const category = url.searchParams.get("category");
      const q = url.searchParams.get("q");
      const sort = url.searchParams.get("sort");
      const min = url.searchParams.get("min");
      const max = url.searchParams.get("max");
      const sizes = url.searchParams.getAll("size");
      const colors = url.searchParams.getAll("color");
      const where: Prisma.ProductWhereInput = {
        ...(!profile ? { isArchived: false } : {}),
        ...(category
          ? {
              categories: {
                some: {
                  category: { OR: [{ slug: category }, { name: category }] },
                },
              },
            }
          : {}),
        ...(q
          ? { name: { contains: q.slice(0, 100), mode: "insensitive" } }
          : {}),
        ...(min || max
          ? {
              salePrice: {
                ...(min ? { gte: money.parse(min) } : {}),
                ...(max ? { lte: money.parse(max) } : {}),
              },
            }
          : {}),
        ...(sizes.length || colors.length
          ? {
              variants: {
                some: {
                  isArchived: false,
                  ...(sizes.length ? { size: { in: sizes } } : {}),
                  ...(colors.length ? { color: { in: colors } } : {}),
                },
              },
            }
          : {}),
      };
      const orderBy: Prisma.ProductOrderByWithRelationInput[] =
        sort === "precio-asc"
          ? [{ salePrice: "asc" }, { id: "asc" }]
          : sort === "precio-desc"
            ? [{ salePrice: "desc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "asc" }];
      const [items, total] = await db.$transaction([
        db.product.findMany({
          where,
          include: {
            ...productInclude,
            variants: profile
              ? productInclude.variants
              : { ...productInclude.variants, where: { isArchived: false } },
          },
          orderBy,
          skip: (page - 1) * take,
          take,
        }),
        db.product.count({ where }),
      ]);
      return json({ items, total, page, pages: Math.ceil(total / take) });
    }
    if (route.startsWith("/v1/products/") && method === "GET") {
      const p = await db.product.findFirst({
        where: { slug: decodeURIComponent(route.slice(13)), isArchived: false },
        include: {
          ...productInclude,
          variants: { where: { isArchived: false } },
          complements: {
            where: { complementary: { isArchived: false } },
            orderBy: { position: "asc" },
            include: {
              complementary: {
                include: {
                  ...productInclude,
                  variants: { where: { isArchived: false } },
                },
              },
            },
          },
        },
      });
      if (!p) throw new AppError(404, "Producto no encontrado");
      return json(p);
    }
    if (route === "/v1/orders" && method === "POST") {
      const input = orderInput.parse(await body(req));
      const phone = Deno.env.get("WHATSAPP_PHONE")?.replace(/[+ ()-]/g, "");
      if (!phone || !/^\d{8,15}$/.test(phone))
        throw new AppError(503, "Pedidos aún no disponibles");
      await shop.rateLimit("phone:" + (await hash(input.clientPhone)), 5);
      const o = await shop.createOrder(input);
      const message = [
        "Hola, mi pedido es #" + o.orderNumber,
        o.clientName,
        ...o.items.map(
          (i) =>
            i.quantity +
            " × " +
            i.productName +
            " / " +
            i.size +
            " / " +
            i.color
        ),
        "Total: $" + o.totalAmount.toFixed(2) + " MXN",
        "Reserva hasta " + o.expiresAt.toISOString(),
      ].join("\n");
      return json(
        {
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmount: o.totalAmount,
          expiresAt: o.expiresAt,
          whatsappUrl:
            "https://wa.me/" + phone + "?text=" + encodeURIComponent(message),
        },
        201
      );
    }
    if (route === "/v1/restock" && method === "POST") {
      const v = subscriptionInput.parse(await body(req));
      await shop.rateLimit("email:" + (await hash(v.email)), 5);
      await shop.subscribe(v.email, v.variantId, v.reactivate);
      return json({ ok: true });
    }
    if (route === "/v1/unsubscribe" && method === "POST") {
      const v = z.object({ token: id }).parse(await body(req));
      await shop.unsubscribe(v.token);
      return json({ ok: true });
    }
    if (route === "/v1/admin/me" && method === "GET") return json(profile);
    if (route === "/v1/admin/health" && method === "GET") {
      const result = await db.$transaction(
        (tx) => tx.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`
      );
      return json({ database: result[0]?.ok === 1 });
    }
    if (route === "/v1/admin/products" && method === "POST")
      return json(
        await shop.saveProduct(productInput.parse(await body(req))),
        201
      );
    const productMatch = route.match(/^\/v1\/admin\/products\/([^/]+)$/);
    if (productMatch && method === "GET")
      return json(
        await db.product.findUniqueOrThrow({
          where: { id: id.parse(productMatch[1]) },
          include: {
            ...productInclude,
            complements: {
              orderBy: { position: "asc" },
              include: { complementary: { include: productInclude } },
            },
          },
        })
      );
    if (productMatch && method === "PUT")
      return json(
        await shop.saveProduct(
          productInput.parse(await body(req)),
          id.parse(productMatch[1])
        )
      );
    if (route === "/v1/admin/variants" && method === "POST")
      return json(
        await db.productVariant.create({
          data: variantInput.parse(await body(req)),
        }),
        201
      );
    const variantMatch = route.match(/^\/v1\/admin\/variants\/([^/]+)$/);
    if (variantMatch && method === "PATCH") {
      const v = z
        .object({ version: z.number().int(), isArchived: z.boolean() })
        .strict()
        .parse(await body(req));
      const r = await db.productVariant.updateMany({
        where: { id: id.parse(variantMatch[1]), version: v.version },
        data: { isArchived: v.isArchived, version: { increment: 1 } },
      });
      if (!r.count) throw new AppError(409, "La variante cambió");
      return json({ ok: true });
    }
    if (route === "/v1/admin/stock" && method === "PATCH") {
      await shop.updateStock(stockInput.parse(await body(req)).changes);
      return json({ ok: true });
    }
    if (route === "/v1/admin/orders" && method === "GET") {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(url.searchParams.get("page") || 1);
      return json(
        await db.order.findMany({
          orderBy: { createdAt: "desc" },
          include: { items: true },
          take: 50,
          skip: (page - 1) * 50,
        })
      );
    }
    const orderMatch = route.match(/^\/v1\/admin\/orders\/([^/]+)$/);
    if (orderMatch && method === "PATCH")
      return json(
        await shop.transition(
          id.parse(orderMatch[1]),
          statusInput.parse(await body(req)).status
        )
      );
    if (route === "/v1/admin/restock" && method === "GET") {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(url.searchParams.get("page") || 1);
      return json(
        await db.restockSubscription.findMany({
          include: {
            variant: { include: { product: { select: { name: true } } } },
            notifications: {
              select: { status: true, attempts: true, lastError: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          skip: (page - 1) * 50,
        })
      );
    }
    if (route === "/v1/admin/restock/retry" && method === "POST") {
      const { notificationId } = z
        .object({ notificationId: id })
        .parse(await body(req));
      const retry = await db.notification.updateMany({
        where: {
          id: notificationId,
          status: "FAILED",
          createdAt: { gt: new Date(Date.now() - 23 * 3600000) },
          subscription: { status: "ACTIVE" },
        },
        data: { status: "PENDING", availableAt: new Date() },
      });
      if (!retry.count)
        throw new AppError(
          409,
          "La notificación requiere revisión de entrega o ya no admite reintentos"
        );
      return json({ ok: true });
    }
    if (route === "/v1/admin/finances" && method === "GET") {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(url.searchParams.get("page") || 1);
      const rows = await db.product.findMany({
        include: { financial: true },
        orderBy: { name: "asc" },
        take: 50,
        skip: (page - 1) * 50,
      });
      return json(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          salePrice: p.salePrice,
          costPrice: p.financial?.costPrice ?? null,
          margin: p.financial
            ? margin(Number(p.salePrice), Number(p.financial.costPrice))
            : null,
        }))
      );
    }
    if (route === "/v1/admin/finances" && method === "PUT") {
      const v = z
        .object({ productId: id, costPrice: money })
        .strict()
        .parse(await body(req));
      return json(
        await db.productCost.upsert({
          where: { productId: v.productId },
          create: v,
          update: { costPrice: v.costPrice },
        })
      );
    }
    if (route === "/v1/admin/roles" && method === "GET")
      return json(
        await db.adminProfile.findMany({
          orderBy: { createdAt: "asc" },
          take: 100,
        })
      );
    if (route === "/v1/admin/roles" && method === "PUT") {
      const v = z
        .object({ id, role: z.enum(["ADMIN", "STAFF"]), active: z.boolean() })
        .strict()
        .parse(await body(req));
      if (v.id === profile?.id)
        throw new AppError(400, "No puedes modificar tu propio rol");
      const { data, error } = await auth.auth.admin.getUserById(v.id);
      if (error || !data.user)
        throw new AppError(400, "El usuario debe existir en Supabase Auth");
      return json(
        await db.adminProfile.upsert({
          where: { id: v.id },
          create: v,
          update: { role: v.role, active: v.active },
        })
      );
    }
    if (route === "/v1/admin/images" && method === "POST") {
      const file = await req.arrayBuffer();
      if (file.byteLength > 5 * 1024 * 1024)
        throw new AppError(413, "Máximo 5 MB por imagen");
      const bytes = new Uint8Array(file);
      const type = req.headers.get("content-type");
      const ext =
        type === "image/jpeg"
          ? "jpg"
          : type === "image/png"
            ? "png"
            : type === "image/webp"
              ? "webp"
              : null;
      const valid =
        ext === "jpg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : ext === "png"
            ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
            : ext === "webp"
              ? new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
                new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
              : false;
      if (!valid || !ext)
        throw new AppError(400, "Usa una imagen JPG, PNG o WebP válida");
      const path = crypto.randomUUID() + "." + ext;
      const { error } = await auth.storage
        .from("product-images")
        .upload(path, file, { contentType: type!, upsert: false });
      if (error) throw new AppError(502, "No se pudo subir la imagen");
      return json(
        {
          path,
          url: supabaseUrl + "/storage/v1/object/public/product-images/" + path,
        },
        201
      );
    }
    throw new AppError(404, "Ruta no encontrada");
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error: "Datos inválidos",
          issues: e.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        400
      );
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2003", "P2025"].includes(e.code)
    )
      return json(
        { error: "El registro ya existe, cambió o tiene relaciones inválidas" },
        409
      );
    console.error("api failure", e instanceof Error ? e.name : "unknown");
    return json({ error: "No se pudo completar la operación" }, 500);
  }
});
