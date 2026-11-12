import { Prisma, PrismaClient } from "../../generated/prisma/client.ts";
import { AppError, hash, mergeItems } from "../../domain.ts";
import type { CreateOrderInput } from "../../contracts.ts";

type Atomic = <T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

export class CreateOrderUseCase {
  constructor(
    private readonly db: PrismaClient,
    private readonly atomic: Atomic
  ) {}
  async execute(input: CreateOrderInput) {
    const items = mergeItems(input.items);
    const requestHash = await hash(
      JSON.stringify({
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        items,
      })
    );
    const replay = async () => {
      const existing = await this.db.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true },
      });
      if (existing && existing.requestHash !== requestHash)
        throw new AppError(
          409,
          "La clave del pedido ya se utilizó con otros datos"
        );
      return existing;
    };
    const existing = await replay();
    if (existing) return existing;
    try {
      return await this.atomic(async (tx) => {
        const lines = [];
        let total = new Prisma.Decimal(0);
        for (const item of items) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true },
          });
          if (!variant || variant.isArchived || variant.product.isArchived)
            throw new AppError(409, "Producto no disponible");
          const changed = await tx.productVariant.updateMany({
            where: {
              id: variant.id,
              stock: { gte: item.quantity },
              isArchived: false,
              product: { isArchived: false },
            },
            data: {
              stock: { decrement: item.quantity },
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1)
            throw new AppError(
              409,
              "Existencias insuficientes para " + variant.sku
            );
          total = total.plus(variant.product.salePrice.mul(item.quantity));
          lines.push({
            variantId: variant.id,
            quantity: item.quantity,
            price: variant.product.salePrice,
            productName: variant.product.name,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
          });
        }
        return tx.order.create({
          data: {
            status: "PENDING_PAYMENT",
            currency: "MXN",
            idempotencyKey: input.idempotencyKey,
            requestHash,
            clientName: input.clientName,
            clientPhone: input.clientPhone,
            totalAmount: total,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            items: { create: lines },
            history: {
              create: { toStatus: "PENDING_PAYMENT", source: "CHECKOUT" },
            },
          },
          include: { items: true },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const prior = await replay();
        if (prior) return prior;
      }
      throw e;
    }
  }
}
