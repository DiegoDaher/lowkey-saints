CREATE TABLE "FinancialSettings" (
 "id" INTEGER PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
 "lowMarginThreshold" DECIMAL(5,2) NOT NULL DEFAULT 30 CHECK ("lowMarginThreshold" BETWEEN 0 AND 100),
 "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "FinancialSettings" ("id") VALUES (1);
ALTER TABLE "FinancialSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialSettings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "FinancialSettings" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "FinancialSettings" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "FinancialSettings" FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "FinancialSettings" TO lowkey_api;
CREATE POLICY backend_only ON "FinancialSettings" TO lowkey_api USING (true) WITH CHECK (true);
