import { CreateOrderUseCase } from "./orders/application/CreateOrderUseCase.ts";
import { Prisma, PrismaClient } from "./generated/prisma/client.ts";
import { AppError, requireTransition } from "./domain.ts";
import type { CreateOrderInput, ProductInput } from "./contracts.ts";
type Tx = Prisma.TransactionClient;
export const productInclude = {
  images: { orderBy: { position: "asc" as const } },
  categories: { include: { category: true } },
  measurements: true,
  variants: { orderBy: { sku: "asc" as const } },
};
export class ShopService {
  constructor(public db: PrismaClient) {}
  async atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(work, {
          isolationLevel: "Serializable",
          timeout: 15000,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2034" &&
          attempt < 3
        )
          continue;
        throw e;
      }
    }
  }
  async createOrder(input: CreateOrderInput) {
    return new CreateOrderUseCase(this.db, (work) => this.atomic(work)).execute(
      input
    );
  }
  async enqueue(tx: Tx, variantId: string) {
    const subscriptions = await tx.restockSubscription.findMany({
      where: { variantId, status: "ACTIVE" },
      select: { id: true, generation: true },
    });
    if (subscriptions.length)
      await tx.notification.createMany({
        data: subscriptions.map((s) => ({
          subscriptionId: s.id,
          generation: s.generation,
        })),
        skipDuplicates: true,
      });
  }
  async transition(
    orderId: string,
    status: "CONFIRMED" | "SHIPPED" | "CANCELLED",
    expiredOnly = false,
    actorId: string | null = null
  ) {
    return this.atomic(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new AppError(404, "Pedido no encontrado");
      const now = new Date();
      if (
        expiredOnly &&
        (order.status !== "PENDING_PAYMENT" || order.expiresAt > now)
      )
        throw new AppError(409, "El pedido ya no es una reserva vencida");
      if (order.status === status) return order;
      requireTransition(order.status, status, order.expiresAt, now);
      const changed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
          ...(status === "CONFIRMED" ? { expiresAt: { gt: now } } : {}),
        },
        data: { status },
      });
      if (!changed.count)
        throw new AppError(409, "El pedido cambió; actualiza la vista");
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: status,
          createdAt: now,
          source: expiredOnly ? "EXPIRATION" : "MANUAL",
          actorId: expiredOnly ? null : actorId,
        },
      });
      if (status === "CANCELLED")
        for (const item of [...order.items].sort((a, b) =>
          a.variantId.localeCompare(b.variantId)
        )) {
          const v = await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: item.quantity },
              version: { increment: 1 },
            },
          });
          if (v.stock === item.quantity) await this.enqueue(tx, v.id);
        }
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
    });
  }
  async expire() {
    const rows = await this.db.order.findMany({
      where: { status: "PENDING_PAYMENT", expiresAt: { lte: new Date() } },
      take: 100,
      orderBy: { expiresAt: "asc" },
      select: { id: true },
    });
    let count = 0;
    for (const row of rows) {
      try {
        await this.transition(row.id, "CANCELLED", true);
        count++;
      } catch (e) {
        if (!(e instanceof AppError && e.status === 409)) throw e;
      }
    }
    return count;
  }
  async updateStock(changes: { id: string; version: number; stock: number }[]) {
    if (new Set(changes.map((x) => x.id)).size !== changes.length)
      throw new AppError(400, "Variante repetida");
    return this.atomic(async (tx) => {
      for (const c of [...changes].sort((a, b) => a.id.localeCompare(b.id))) {
        const before = await tx.productVariant.findUnique({
          where: { id: c.id },
        });
        if (!before) throw new AppError(404, "Variante no encontrada");
        const result = await tx.productVariant.updateMany({
          where: { id: c.id, version: c.version },
          data: { stock: c.stock, version: { increment: 1 } },
        });
        if (!result.count)
          throw new AppError(
            409,
            "El inventario cambió; recarga antes de guardar"
          );
        if (before.stock === 0 && c.stock > 0) await this.enqueue(tx, c.id);
      }
    });
  }
  async subscribe(email: string, variantId: string, reactivate: boolean) {
    return this.atomic(async (tx) => {
      const v = await tx.productVariant.findFirst({
        where: {
          id: variantId,
          isArchived: false,
          product: { isArchived: false },
        },
      });
      if (!v || v.stock > 0)
        throw new AppError(409, "La variante no está agotada");
      const prior = await tx.restockSubscription.findUnique({
        where: { email_variantId: { email, variantId } },
      });
      if (!prior) {
        await tx.restockSubscription.create({ data: { email, variantId } });
        return;
      }
      if (reactivate && prior.status !== "ACTIVE")
        await tx.restockSubscription.update({
          where: { id: prior.id },
          data: {
            status: "ACTIVE",
            generation: { increment: 1 },
            unsubscribeToken: crypto.randomUUID(),
          },
        });
    });
  }
  async unsubscribe(token: string) {
    await this.atomic(async (tx) => {
      const s = await tx.restockSubscription.findUnique({
        where: { unsubscribeToken: token },
      });
      if (!s) return;
      await tx.restockSubscription.update({
        where: { id: s.id },
        data: { status: "UNSUBSCRIBED" },
      });
      await tx.notification.updateMany({
        where: { subscriptionId: s.id, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "CANCELLED" },
      });
    });
  }
  async saveProduct(input: ProductInput, productId?: string) {
    if (
      new Set(input.complementaryIds).size !== input.complementaryIds.length ||
      input.complementaryIds.includes(productId || "")
    )
      throw new AppError(400, "Productos complementarios inválidos");
    const {
      categoryIds,
      images,
      measurements,
      complementaryIds,
      version,
      ...fields
    } = input;
    return this.atomic(async (tx) => {
      const data = {
        ...fields,
        modelHeightCm:
          fields.modelHeightCm === null ? null : fields.modelHeightCm,
      };
      let id = productId;
      if (id) {
        const r = await tx.product.updateMany({
          where: { id, version: version ?? -1 },
          data: { ...data, version: { increment: 1 } },
        });
        if (!r.count)
          throw new AppError(409, "El producto cambió; recarga la vista");
      } else {
        id = (await tx.product.create({ data })).id;
      }
      await tx.productCategory.deleteMany({ where: { productId: id } });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.sizeMeasurement.deleteMany({ where: { productId: id } });
      await tx.productComplement.deleteMany({ where: { productId: id } });
      await tx.productCategory.createMany({
        data: [...new Set(categoryIds)].map((categoryId) => ({
          productId: id!,
          categoryId,
        })),
      });
      if (images.length)
        await tx.productImage.createMany({
          data: images.map((im, position) => ({
            ...im,
            productId: id!,
            position,
          })),
        });
      if (measurements.length)
        await tx.sizeMeasurement.createMany({
          data: measurements.map((m) => ({ ...m, productId: id! })),
        });
      if (complementaryIds.length)
        await tx.productComplement.createMany({
          data: complementaryIds.map((complementaryId, position) => ({
            productId: id!,
            complementaryId,
            position,
          })),
        });
      return tx.product.findUniqueOrThrow({
        where: { id },
        include: productInclude,
      });
    });
  }
  async rateLimit(key: string, limit: number) {
    const slot = Math.floor(Date.now() / 60000);
    const result = await this.db.rateLimit.upsert({
      where: { key: key + ":" + slot },
      create: {
        key: key + ":" + slot,
        expiresAt: new Date((slot + 2) * 60000),
      },
      update: { count: { increment: 1 } },
    });
    if (result.count > limit)
      throw new AppError(429, "Demasiadas solicitudes; intenta en un minuto");
  }
}
