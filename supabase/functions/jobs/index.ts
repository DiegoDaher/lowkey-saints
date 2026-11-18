import { createClient } from "@supabase/supabase-js";
import { cleanMedia } from "../_shared/storage/media.ts";
import { productStorage } from "../_shared/storage/adapter.ts";
import { db } from "../_shared/db.ts";
import { ShopService } from "../_shared/service.ts";
import { deliverNotifications } from "../_shared/notifications.ts";
import { hash } from "../_shared/domain.ts";
const shop = new ShopService(db);
Deno.serve(async (req) => {
  const secret = Deno.env.get("JOB_SECRET");
  const provided = req.headers.get("authorization");
  if (
    req.method !== "POST" ||
    !secret ||
    !provided ||
    (await hash(provided)) !== (await hash("Bearer " + secret))
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const payload = await req.json().catch(() => ({}));
    if (payload.probe) {
      const result = await db.$transaction(
        (tx) =>
          tx.$queryRaw`SELECT 1 AS ok, ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()`
      );
      return Response.json({ transaction: result });
    }
    const expired = await shop.expire();
    await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const apiKey = Deno.env.get("RESEND_API_KEY"),
      from = Deno.env.get("RESEND_FROM"),
      siteUrl = Deno.env.get("SITE_URL");
    const sent =
      apiKey && from && siteUrl?.startsWith("https://")
        ? await deliverNotifications(db, { apiKey, from, siteUrl })
        : null;
    let media = null;
    if (Deno.env.get("MEDIA_CLEANUP_ENABLED") === "true") {
      try {
        const storage = productStorage(
          createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false, autoRefreshToken: false } }
          )
        );
        media = await cleanMedia(db, storage);
      } catch {
        console.error("media.cleanup.failed");
      }
    }
    console.log(
      JSON.stringify({
        event: "jobs.completed",
        expired,
        media,
        sent,
        mailConfigured: sent !== null,
      })
    );
    return Response.json({ expired, sent, media });
  } catch (e) {
    console.error("jobs.failed", e instanceof Error ? e.name : "unknown");
    return Response.json({ error: "Job failed" }, { status: 500 });
  }
});
