CREATE TYPE "OrderHistorySource" AS ENUM ('CHECKOUT', 'MANUAL', 'EXPIRATION');
CREATE TABLE "OrderStatusHistory" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "fromStatus" "OrderStatus",
  "toStatus" "OrderStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "OrderHistorySource" NOT NULL,
  "actorId" UUID,
  CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");
ALTER TABLE "OrderStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderStatusHistory" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "OrderStatusHistory" FROM PUBLIC, lowkey_api;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "OrderStatusHistory" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "OrderStatusHistory" FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT ON "OrderStatusHistory" TO lowkey_api;
CREATE POLICY history_read ON "OrderStatusHistory" FOR SELECT TO lowkey_api USING (true);
CREATE POLICY history_insert ON "OrderStatusHistory" FOR INSERT TO lowkey_api WITH CHECK (true);
