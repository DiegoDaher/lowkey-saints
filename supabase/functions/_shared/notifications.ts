import type { PrismaClient } from "./generated/prisma/client.ts";
export async function deliverNotifications(
  db: PrismaClient,
  config: { apiKey: string; from: string; siteUrl: string },
  send: typeof fetch = fetch
) {
  const now = new Date();
  await db.notification.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: new Date(now.getTime() - 5 * 60000) },
    },
    data: { status: "PENDING", lockedAt: null },
  });
  const rows = await db.notification.findMany({
    where: { status: "PENDING", availableAt: { lte: now } },
    take: 25,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  for (const row of rows) {
    const claim = await db.notification.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
    });
    if (!claim.count) continue;
    const sub = await db.restockSubscription.findUniqueOrThrow({
      where: { id: row.subscriptionId },
      include: { variant: { include: { product: true } } },
    });
    if (
      sub.status !== "ACTIVE" ||
      sub.generation !== row.generation ||
      sub.variant.isArchived ||
      sub.variant.product.isArchived
    ) {
      await db.notification.update({
        where: { id: row.id },
        data: { status: "CANCELLED", lockedAt: null },
      });
      continue;
    }
    if (sub.variant.stock === 0) {
      await db.notification.update({
        where: { id: row.id },
        data: {
          status: "PENDING",
          lockedAt: null,
          availableAt: new Date(Date.now() + 15 * 60000),
        },
      });
      continue;
    }
    // Resend deduplicates for 24 hours. Never automatically resend an ambiguous older delivery.
    if (
      row.attempts > 0 &&
      row.createdAt.getTime() < Date.now() - 23 * 3600000
    ) {
      await db.notification.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          lastError: "Entrega incierta: revisar proveedor antes de reintentar",
          lockedAt: null,
        },
      });
      continue;
    }
    try {
      const res = await send("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.apiKey,
          "Content-Type": "application/json",
          "Idempotency-Key": row.id,
        },
        body: JSON.stringify({
          from: config.from,
          to: [sub.email],
          subject: "Volvió " + sub.variant.product.name,
          text:
            sub.variant.product.name +
            " / " +
            sub.variant.size +
            " / " +
            sub.variant.color +
            " está disponible.\n" +
            config.siteUrl +
            "/productos/" +
            sub.variant.product.slug +
            "\nCancelar avisos: " +
            config.siteUrl +
            "/baja?token=" +
            sub.unsubscribeToken,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("Proveedor respondió HTTP " + res.status);
      await db.$transaction(async (tx) => {
        await tx.notification.update({
          where: { id: row.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            lockedAt: null,
            lastError: null,
          },
        });
        await tx.restockSubscription.updateMany({
          where: { id: sub.id, status: "ACTIVE", generation: row.generation },
          data: { status: "NOTIFIED" },
        });
      });
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      await db.notification.update({
        where: { id: row.id },
        data: {
          status: attempts >= 5 ? "FAILED" : "PENDING",
          lockedAt: null,
          availableAt: new Date(
            Date.now() + Math.min(60, 2 ** attempts) * 60000
          ),
          lastError:
            e instanceof Error ? e.message.slice(0, 200) : "Error de entrega",
        },
      });
    }
  }
  return sent;
}
