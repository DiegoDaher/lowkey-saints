import "dotenv/config";
import pg from "pg";
import { writeFile } from "node:fs/promises";
const url = new URL(process.env.APP_DATABASE_URL);
url.searchParams.set("sslmode", "verify-full");
const client = new pg.Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 10000,
});
let report;
try {
  await client.connect();
  const result = await client.query(
    "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
  );
  report = {
    timestamp: new Date().toISOString(),
    mode: "verify-full",
    clientEncrypted: Boolean(client.connection.stream.encrypted),
    clientAuthorized: client.connection.stream.authorized === true,
    server: result.rows,
  };
} catch (e) {
  report = {
    timestamp: new Date().toISOString(),
    mode: "verify-full",
    blocked: true,
    error: e.code || e.name,
  };
} finally {
  await client.end();
}
await writeFile(
  "docs/evidencias/seguridad-apis/tls-probe.json",
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report));
