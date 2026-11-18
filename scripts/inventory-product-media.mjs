import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { postgresTlsConfig } from "../supabase/functions/_shared/postgres-tls.mjs";
import { listStorageObjects } from "./lib/storage-inventory.mjs";

const apply = process.argv.includes("--apply");
const storage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
).storage.from("product-images");
const db = new pg.Client({ ...postgresTlsConfig(process.env.DIRECT_URL) });
await db.connect();
try {
  const objects = await listStorageObjects(storage);
  const objectSet = new Set(objects);
  const references = (
    await db.query('SELECT DISTINCT path FROM "ProductImage"')
  ).rows.map((row) => row.path);
  const referenced = new Set(references);
  const orphaned = objects.filter((path) => !referenced.has(path));
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "report",
        total: objects.length,
        orphaned,
        missing: references.filter((path) => !objectSet.has(path)),
        graceHours: 24,
      },
      null,
      2
    )
  );
  if (apply) {
    await db.query("BEGIN");
    try {
      // Do not change an existing record: its writer/worker owns its lifecycle.
      for (const path of objects.sort()) {
        await db.query(
          `INSERT INTO "ProductMediaAsset" (id,path,state,"expiresAt")
          VALUES ($1,$2,CASE WHEN EXISTS(SELECT 1 FROM "ProductImage" WHERE path=$2)
            THEN 'ATTACHED'::"ProductMediaState" ELSE 'TEMPORARY'::"ProductMediaState" END,
            now() + interval '24 hours') ON CONFLICT (path) DO NOTHING`,
          [randomUUID(), path]
        );
      }
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await db.end();
}
