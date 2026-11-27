import type { Prisma } from "../../generated/prisma/client.ts";

/**
 * Queues one notification per ACTIVE subscription when variants become
 * available again: stock 0 → >0, or unarchiving a variant/product with stock.
 * Runs inside the caller's transaction.
 *
 * A row CANCELLED for the current generation (e.g. the variant was archived
 * while it waited) is revived; rows of unsubscribed or older generations are not.
 */
export class NotifyBackInStockUseCase {
  async execute(tx: Prisma.TransactionClient, variantIds: string[]) {
    if (!variantIds.length) return 0;
    const subscriptions = await tx.restockSubscription.findMany({
      where: { variantId: { in: variantIds }, status: "ACTIVE" },
      select: { id: true, generation: true },
    });
    if (!subscriptions.length) return 0;
    const keys = subscriptions.map((s) => ({
      subscriptionId: s.id,
      generation: s.generation,
    }));
    const created = await tx.notification.createMany({
      data: keys,
      skipDuplicates: true,
    });
    const revived = await tx.notification.updateMany({
      where: { status: "CANCELLED", OR: keys },
      // attempts/firstAttemptAt are kept: an earlier ambiguous POST still
      // counts for the duplicate-delivery guard.
      data: {
        status: "PENDING",
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    return created.count + revived.count;
  }
}
