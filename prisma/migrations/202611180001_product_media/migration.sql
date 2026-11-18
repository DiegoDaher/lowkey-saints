CREATE TYPE "ProductMediaState" AS ENUM ('UPLOADING', 'TEMPORARY', 'ATTACHED', 'DELETE_PENDING', 'DELETING', 'DELETED');
CREATE TABLE "ProductMediaAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "path" TEXT NOT NULL UNIQUE,
  "createdBy" UUID,
  "state" "ProductMediaState" NOT NULL DEFAULT 'UPLOADING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMP(3),
  "leaseToken" TEXT,
  "lastError" TEXT
);
CREATE INDEX "ProductMediaAsset_state_availableAt_idx" ON "ProductMediaAsset" ("state", "availableAt");
CREATE INDEX "ProductMediaAsset_state_expiresAt_idx" ON "ProductMediaAsset" ("state", "expiresAt");
INSERT INTO "ProductMediaAsset" (id, path, state)
SELECT gen_random_uuid()::text, path, 'ATTACHED'::"ProductMediaState" FROM "ProductImage" GROUP BY path;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_path_fkey" FOREIGN KEY (path) REFERENCES "ProductMediaAsset"(path) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProductImage_path_idx" ON "ProductImage" (path);
ALTER TABLE "ProductMediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductMediaAsset" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "ProductMediaAsset" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ProductMediaAsset" FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ProductMediaAsset" FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ProductMediaAsset" TO lowkey_api;
CREATE POLICY backend_only ON "ProductMediaAsset" TO lowkey_api USING (true) WITH CHECK (true);
