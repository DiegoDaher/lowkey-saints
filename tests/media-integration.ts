import type { PrismaClient } from "../supabase/functions/_shared/generated/prisma/client.ts";
import { ShopService } from "../supabase/functions/_shared/service.ts";
import {
  cleanMedia,
  discardMedia,
  uploadMedia,
  MEDIA_TTL,
} from "../supabase/functions/_shared/storage/media.ts";
import type { ProductStorage } from "../supabase/functions/_shared/storage/adapter.ts";
import { productInput } from "../supabase/functions/_shared/contracts.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function rejects(work: () => Promise<unknown>, status: number) {
  try {
    await work();
  } catch (error) {
    assert(
      (error as { status: number }).status === status,
      `expected ${status}: ${error}`
    );
    return;
  }
  throw new Error(`Expected rejection ${status}`);
}

export async function mediaIntegration(db: PrismaClient) {
  const actor = crypto.randomUUID();
  const objects = new Set<string>();
  let failRemove = false,
    failUpload = false;
  const storage: ProductStorage = {
    async upload(path) {
      objects.add(path);
      if (failUpload) throw new Error("uncertain");
    },
    async remove(path) {
      if (failRemove) throw new Error("offline");
      objects.delete(path);
    },
    publicUrl: (path) => "https://storage.example/" + path,
  };
  const shop = new ShopService(db);
  const bytes = new Uint8Array([255, 216, 255]);
  const upload = () => uploadMedia(db, storage, bytes, "image/jpeg", actor);
  const category = await db.category.findFirstOrThrow();
  const input = (paths: string[]) =>
    productInput.parse({
      name: "Media test",
      slug: crypto.randomUUID(),
      salePrice: "100",
      description: "",
      materials: "",
      specifications: "",
      modelHeightCm: null,
      modelSize: null,
      categoryIds: [category.id],
      images: paths.map((path) => ({ path, alt: "Foto" })),
      measurements: [],
      complementaryIds: [],
    });
  const a = await upload(),
    b = await upload();
  const draft = input([a.path, b.path]);
  assert(
    !productInput.safeParse({
      ...draft,
      images: [draft.images[0], draft.images[0]],
    }).success,
    "duplicate images rejected"
  );
  await rejects(() => discardMedia(db, a.id, crypto.randomUUID()), 404);
  await rejects(
    () => shop.saveProduct(draft, undefined, crypto.randomUUID()),
    409
  );
  const p = await shop.saveProduct(draft, undefined, actor);
  assert(
    p.images[0].path === a.path && p.images[1].position === 1,
    "ordered persistence"
  );
  await rejects(() => discardMedia(db, a.id, actor), 409);
  await rejects(
    () => shop.saveProduct({ ...draft, images: [], version: 9 }, p.id, actor),
    409
  );
  assert(
    (await db.productImage.count({ where: { productId: p.id } })) === 2,
    "conflict preserves images"
  );
  const shared = await shop.saveProduct(input([a.path]), undefined, actor);
  await shop.saveProduct({ ...draft, images: [], version: 0 }, p.id, actor);
  await cleanMedia(db, storage);
  assert(
    objects.has(a.path) && !objects.has(b.path),
    "shared image retained, removed image deleted"
  );
  await shop.saveProduct({ ...input([]), version: 0 }, shared.id, actor);
  await Promise.all([cleanMedia(db, storage), cleanMedia(db, storage)]);
  assert(!objects.has(a.path), "concurrent workers clean final reference");

  const abandoned = await upload();
  const later = new Date(Date.now() + MEDIA_TTL + 1000);
  failRemove = true;
  await cleanMedia(db, storage, later);
  let row = await db.productMediaAsset.findUniqueOrThrow({
    where: { id: abandoned.id },
  });
  assert(
    row.state === "DELETE_PENDING" &&
      row.attempts === 1 &&
      objects.has(abandoned.path),
    "retry persisted"
  );
  failRemove = false;
  await cleanMedia(db, storage, new Date(row.availableAt.getTime() + 1));
  assert(!objects.has(abandoned.path), "retry succeeds");
  const discarded = await upload();
  await discardMedia(db, discarded.id, actor);
  await discardMedia(db, discarded.id, actor);
  await rejects(
    () => shop.saveProduct(input([discarded.path]), undefined, actor),
    409
  );
  await cleanMedia(db, storage);
  assert(!objects.has(discarded.path), "discard is idempotent");

  failUpload = true;
  await rejects(upload, 502);
  failUpload = false;
  const uncertain = await db.productMediaAsset.findFirstOrThrow({
    where: { createdBy: actor, state: "UPLOADING" },
  });
  assert(objects.has(uncertain.path), "failed response preserves reservation");
  await cleanMedia(db, storage, later);
  assert(!objects.has(uncertain.path), "uncertain uploads reclaimed");

  const interrupted = await upload();
  objects.delete(interrupted.path); // Crash after external delete, before DB acknowledgement.
  await db.productMediaAsset.update({
    where: { id: interrupted.id },
    data: {
      state: "DELETING",
      lockedAt: new Date(Date.now() - 360000),
      leaseToken: "lost",
    },
  });
  await cleanMedia(db, storage);
  row = await db.productMediaAsset.findUniqueOrThrow({
    where: { id: interrupted.id },
  });
  assert(row.state === "DELETED", "stale lease and absent object recovered");

  // A storage call held open must prevent a competing save from resurrecting the path.
  const racing = await upload();
  await discardMedia(db, racing.id, actor);
  let started!: () => void, release!: () => void;
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cleanup = cleanMedia(db, {
    ...storage,
    async remove(path) {
      started();
      await hold;
      await storage.remove(path);
    },
  });
  await begun;
  try {
    await rejects(
      () => shop.saveProduct(input([racing.path]), undefined, actor),
      409
    );
  } finally {
    release();
    await cleanup;
  }
  assert(!objects.has(racing.path), "in-flight deletion cannot be referenced");

  const candidate = await upload();
  const race = await Promise.allSettled([
    shop.saveProduct(input([candidate.path]), undefined, actor),
    cleanMedia(db, storage, later),
  ]);
  const references = await db.productImage.count({
    where: { path: candidate.path },
  });
  assert(
    references ? objects.has(candidate.path) : !objects.has(candidate.path),
    "save/cleanup race never creates dangling reference"
  );
  assert(race[1].status === "fulfilled", "cleanup race completes");

  for (const role of ["anon", "authenticated", "lowkey_api"]) {
    let allowed = false;
    try {
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE " + role);
        await tx.productMediaAsset.findMany({ take: 1 });
      });
      allowed = true;
    } catch {
      /* expected for browser roles */
    }
    assert(allowed === (role === "lowkey_api"), "asset RLS " + role);
  }
  console.log("ADM-04 media integration assertions passed");

  // Exercise the real upload adapter and HTTP contracts, including actor forwarding on PUT.
  const { createApiHandler } =
    await import("../supabase/functions/api/handler.ts");
  await db.adminProfile.create({ data: { id: actor, role: "ADMIN" } });
  const handler = createApiHandler(db, {
    auth: {
      getUser: async () => ({ data: { user: { id: actor } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async (
          path: string,
          bytes: Uint8Array,
          options: { contentType: string }
        ) => {
          await storage.upload(path, bytes, options.contentType);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) await storage.remove(path);
          return { error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: storage.publicUrl(path) },
        }),
      }),
    },
  } as unknown as NonNullable<Parameters<typeof createApiHandler>[1]>);
  const request = (
    path: string,
    method: string,
    body?: BodyInit,
    type = "application/json"
  ) =>
    handler(
      new Request("http://localhost/v1/admin" + path, {
        method,
        headers: { Authorization: "Bearer media-admin", "Content-Type": type },
        body,
      })
    );
  assert(
    (await request("/images", "POST", "invalid", "image/jpeg")).status === 400,
    "HTTP invalid signature"
  );
  const response = await request("/images", "POST", bytes, "image/jpeg");
  assert(response.status === 201, "HTTP upload succeeds");
  const uploaded = await response.json();
  assert(
    uploaded.id && uploaded.path && uploaded.url && uploaded.expiresAt,
    "additive upload contract"
  );
  const productResponse = await request(
    "/products",
    "POST",
    JSON.stringify(input([uploaded.path]))
  );
  assert(
    productResponse.status === 201,
    "POST associates actor's temporary image"
  );
  const product = await productResponse.json();
  const replacement = await (
    await request("/images", "POST", bytes, "image/jpeg")
  ).json();
  const edited = await request(
    "/products/" + product.id,
    "PUT",
    JSON.stringify({ ...input([replacement.path]), version: 0 })
  );
  assert(edited.status === 200, "PUT associates actor's temporary image");
  assert(
    (await request("/images/" + replacement.id, "DELETE")).status === 409,
    "HTTP cannot discard attached image"
  );
  const temporary = await (
    await request("/images", "POST", bytes, "image/jpeg")
  ).json();
  assert(
    (await request("/images/" + temporary.id, "DELETE")).status === 202,
    "HTTP discard accepted"
  );
}
