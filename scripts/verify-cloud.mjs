import "dotenv/config";
import pg from "pg";
const client = new pg.Client({connectionString: process.env.DIRECT_URL, connectionTimeoutMillis:10000});
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const migrations = await client.query('SELECT migration_name, finished_at IS NOT NULL AS applied FROM "_prisma_migrations" ORDER BY migration_name');
  const policies = await client.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY relname");
  const admins = await client.query('SELECT count(*)::int AS count FROM "AdminProfile" WHERE active AND role=\'ADMIN\'');
  const accounts = await client.query("SELECT count(*)::int AS count FROM auth.users");
  const jobs = await client.query("SELECT to_regclass('cron.job') IS NOT NULL AS configured");
  console.log(JSON.stringify({migrations:migrations.rows,policies:policies.rows,admins:admins.rows[0].count,authAccounts:accounts.rows[0].count,cron:jobs.rows[0].configured}));
  if(jobs.rows[0].configured) {
    console.log('schedule', (await client.query("SELECT jobname,schedule,active FROM cron.job WHERE jobname='lowkey-jobs'")).rows);
    console.log('recent runs', (await client.query("SELECT status, return_message, start_time FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='lowkey-jobs') ORDER BY start_time DESC LIMIT 3")).rows);
    console.log('recent HTTP responses', (await client.query("SELECT status_code, timed_out, error_msg FROM net._http_response ORDER BY created DESC LIMIT 3")).rows);
  }
  await client.query("ROLLBACK");
} finally { await client.end(); }
