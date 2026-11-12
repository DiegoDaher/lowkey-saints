import "dotenv/config";
import pg from "pg";
import { postgresTlsConfig } from "../supabase/functions/_shared/postgres-tls.mjs";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required (read-only inspection)");
const client = new pg.Client({
  ...postgresTlsConfig(url),
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  const { rows: migrations } = await client.query(
    'SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at'
  );
  const { rows: states } = await client.query(
    'SELECT status, count(*)::int AS count FROM "Order" GROUP BY status ORDER BY status'
  );
  const { rows: checks } = await client.query(`SELECT
    (SELECT count(*)::int FROM "Order" o WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId"=o.id)) AS orders_without_items,
    (SELECT count(*)::int FROM "Order" o WHERE o."totalAmount" != (SELECT sum(i.price * i.quantity) FROM "OrderItem" i WHERE i."orderId"=o.id)) AS inconsistent_totals,
    (SELECT count(*)::int FROM "ProductVariant" WHERE stock < 0) AS negative_stock,
    (SELECT count(*)::int FROM "Order" WHERE "expiresAt" <= "createdAt") AS invalid_reservation_dates,
    (SELECT count(*)::int FROM "Order" WHERE status='PENDING_PAYMENT' AND "expiresAt" <= now()) AS expired_pending`);
  const { rows: history } = await client.query(
    "SELECT to_regclass('public.\"OrderStatusHistory\"') IS NOT NULL AS installed"
  );
  console.log(
    JSON.stringify(
      {
        migrations,
        states,
        checks: checks[0],
        historyInstalled: history[0].installed,
      },
      null,
      2
    )
  );
  await client.query("ROLLBACK");
} catch (error) {
  console.error(
    error.code || error.name,
    "Read-only order inspection failed (credentials omitted)"
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
