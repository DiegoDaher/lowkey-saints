import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import { AppError } from "../domain.ts";
import type { ProductStorage } from "./adapter.ts";
import { imageExtension } from "./validation.ts";

export const MEDIA_TTL = 24 * 60 * 60 * 1000;
type Tx = Prisma.TransactionClient;

// Every reference writer locks these rows in the same order before making changes.
export async function lockMedia(tx: Tx, paths: string[]) {
  for (const path of [...new Set(paths)].sort()) {
    await tx.$queryRaw`SELECT id FROM "ProductMediaAsset" WHERE path = ${path} FOR UPDATE`;
  }
}

export async function uploadMedia(
  db: PrismaClient,
  storage: ProductStorage,
  bytes: Uint8Array,
  type: string | null,
  actor: string
) {
  const ext = imageExtension(bytes, type);
  const expiresAt = new Date(Date.now() + MEDIA_TTL);
  const asset = await db.productMediaAsset.create({
    data: {
      path: crypto.randomUUID() + "." + ext,
      createdBy: actor,
      expiresAt,
    },
  });
  try {
    await storage.upload(asset.path, bytes, type!);
    await db.productMediaAsset.update({
      where: { id: asset.id },
      data: { state: "TEMPORARY" },
    });
  } catch {
    // Preserve the reservation when upload completion is uncertain.
    throw new AppError(502, "No se pudo subir la imagen. Puedes reintentar.");
  }
  return {
    id: asset.id,
    path: asset.path,
    url: storage.publicUrl(asset.path),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function discardMedia(
  db: PrismaClient,
  id: string,
  actor: string
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ProductMediaAsset" WHERE id = ${id} FOR UPDATE`;
    const asset = await tx.productMediaAsset.findUnique({ where: { id } });
    if (!asset || asset.createdBy !== actor)
      throw new AppError(404, "Imagen no encontrada");
    if (
      asset.state === "ATTACHED" ||
      (await tx.productImage.count({ where: { path: asset.path } }))
    )
      throw new AppError(409, "La imagen está vinculada a un producto");
    if (["DELETE_PENDING", "DELETING", "DELETED"].includes(asset.state)) return;
    if (asset.state === "UPLOADING")
      throw new AppError(409, "La imagen todavía se está subiendo");
    await tx.productMediaAsset.update({
      where: { id },
      data: { state: "DELETE_PENDING", availableAt: new Date() },
    });
  });
}

export async function attachMedia(
  tx: Tx,
  paths: string[],
  previous: string[],
  actor?: string
) {
  await lockMedia(tx, [...paths, ...previous]);
  const now = new Date();
  for (const path of paths) {
    const asset = await tx.productMediaAsset.findUnique({ where: { path } });
    if (
      !asset ||
      !["TEMPORARY", "ATTACHED"].includes(asset.state) ||
      (asset.state === "TEMPORARY" &&
        (!actor ||
          asset.createdBy !== actor ||
          !asset.expiresAt ||
          asset.expiresAt <= now))
    )
      throw new AppError(
        409,
        "Una imagen ya no está disponible; vuelve a subirla"
      );
    await tx.productMediaAsset.update({
      where: { path },
      data: { state: "ATTACHED", expiresAt: null },
    });
  }
}

export async function detachMedia(tx: Tx, previous: string[], next: string[]) {
  for (const path of previous.filter((p) => !next.includes(p))) {
    if (!(await tx.productImage.count({ where: { path } })))
      await tx.productMediaAsset.update({
        where: { path },
        data: { state: "DELETE_PENDING", availableAt: new Date() },
      });
  }
}

export async function cleanMedia(
  db: PrismaClient,
  storage: ProductStorage,
  now = new Date()
) {
  const stale = new Date(now.getTime() - 5 * 60 * 1000);
  const candidates = await db.productMediaAsset.findMany({
    where: {
      OR: [
        { state: { in: ["UPLOADING", "TEMPORARY"] }, expiresAt: { lte: now } },
        { state: "DELETE_PENDING", availableAt: { lte: now } },
        { state: "DELETING", lockedAt: { lte: stale } },
      ],
    },
    orderBy: [{ availableAt: "asc" }, { id: "asc" }],
    take: 25,
  });
  let deleted = 0,
    failed = 0;
  for (const candidate of candidates) {
    const leaseToken = crypto.randomUUID();
    const asset = await db.$transaction(async (tx) => {
      await lockMedia(tx, [candidate.path]);
      const current = await tx.productMediaAsset.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      const eligible =
        (["UPLOADING", "TEMPORARY"].includes(current.state) &&
          current.expiresAt &&
          current.expiresAt <= now) ||
        (current.state === "DELETE_PENDING" && current.availableAt <= now) ||
        (current.state === "DELETING" &&
          current.lockedAt &&
          current.lockedAt <= stale);
      if (!eligible) return null;
      if (await tx.productImage.count({ where: { path: current.path } })) {
        await tx.productMediaAsset.update({
          where: { id: current.id },
          data: {
            state: "ATTACHED",
            expiresAt: null,
            lockedAt: null,
            leaseToken: null,
          },
        });
        return null;
      }
      return tx.productMediaAsset.update({
        where: { id: current.id },
        data: {
          state: "DELETING",
          lockedAt: now,
          leaseToken,
          attempts: { increment: 1 },
        },
      });
    });
    if (!asset) continue;
    try {
      await storage.remove(asset.path);
      await db.productMediaAsset.updateMany({
        where: { id: asset.id, leaseToken },
        data: {
          state: "DELETED",
          lockedAt: null,
          leaseToken: null,
          lastError: null,
        },
      });
      deleted++;
    } catch {
      failed++;
      await db.productMediaAsset.updateMany({
        where: { id: asset.id, leaseToken },
        data: {
          state: "DELETE_PENDING",
          lockedAt: null,
          leaseToken: null,
          lastError: "Storage removal failed",
          availableAt: new Date(
            now.getTime() +
              Math.min(3600, 60 * 2 ** Math.min(asset.attempts - 1, 6)) * 1000
          ),
        },
      });
    }
  }
  return { examined: candidates.length, deleted, failed };
}
