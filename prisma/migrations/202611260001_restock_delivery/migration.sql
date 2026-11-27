-- LOG-06: attempts count real provider POSTs only; firstAttemptAt starts the dedup window.
ALTER TABLE "Notification" ADD COLUMN "firstAttemptAt" TIMESTAMP(3);
-- Conservative backfill: older rows may have counted stock waits as attempts.
UPDATE "Notification" SET "firstAttemptAt" = "createdAt" WHERE "attempts" > 0;
