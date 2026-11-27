import { Prisma, PrismaClient } from "../../generated/prisma/client.ts";
import { AppError } from "../../AppError.ts";
import type { RestockResult } from "../../contracts.ts";
import { decideSubscription } from "../domain/RestockSubscriptionPolicy.ts";

type Atomic = <T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

export class SubscribeToRestockUseCase {
  constructor(
    private readonly db: PrismaClient,
    private readonly atomic: Atomic
  ) {}
  async execute(
    email: string,
    variantId: string,
    reactivate: boolean
  ): Promise<RestockResult> {
    try {
      return await this.atomic(async (tx) => {
        const variant = await tx.productVariant.findFirst({
          where: {
            id: variantId,
            isArchived: false,
            product: { isArchived: false },
          },
          select: { stock: true },
        });
        if (!variant)
          throw new AppError(404, "Esta variante ya no está disponible");
        if (variant.stock > 0)
          throw new AppError(409, "La variante no está agotada");
        const prior = await tx.restockSubscription.findUnique({
          where: { email_variantId: { email, variantId } },
          select: { id: true, status: true },
        });
        const decision = decideSubscription(prior, reactivate);
        if (decision.action === "create")
          await tx.restockSubscription.create({ data: { email, variantId } });
        if (decision.action === "reactivate" && prior)
          await tx.restockSubscription.update({
            where: { id: prior.id },
            data: {
              status: "ACTIVE",
              generation: { increment: 1 },
              unsubscribeToken: crypto.randomUUID(),
            },
          });
        return decision.result;
      });
    } catch (e) {
      // Two identical requests raced on the unique (email, variantId) pair:
      // the other one created the subscription, so this one is a duplicate.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        return "active";
      throw e;
    }
  }
}
