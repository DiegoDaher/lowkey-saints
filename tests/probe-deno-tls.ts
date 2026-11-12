import pg from "npm:pg@8.23.1";
import { checkServerIdentity, rootCertificates } from "node:tls";
import { postgresTlsConfig } from "../supabase/functions/_shared/postgres-tls.mjs";
const config = postgresTlsConfig(Deno.env.get("APP_DATABASE_URL")!);
const checks: {
  name: string;
  connected: boolean;
  expectedRejection: boolean;
  server?: unknown;
  error?: string;
}[] = [];
for (const [name, ssl, reject] of [
  ["CA y hostname reales", config.ssl, false],
  ["CA ajena", { ...config.ssl, ca: rootCertificates[0] }, true],
  [
    "Hostname incorrecto",
    {
      ...config.ssl,
      checkServerIdentity: (
        _host: string,
        cert: Parameters<typeof checkServerIdentity>[1]
      ) => checkServerIdentity("incorrect-host.example.invalid", cert),
    },
    true,
  ],
] as const) {
  const client = new pg.Client({
    ...config,
    ssl,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    );
    checks.push({
      name,
      connected: true,
      expectedRejection: reject,
      server: result.rows,
    });
  } catch (e) {
    checks.push({
      name,
      connected: false,
      expectedRejection: reject,
      error:
        e instanceof Error
          ? (e as Error & { code?: string }).code || e.name
          : "unknown",
    });
  } finally {
    await client.end();
  }
}
const report = {
  timestamp: new Date().toISOString(),
  environment: "Deno local",
  passed: checks.every((check) => check.connected !== check.expectedRejection),
  checks,
};
await Deno.writeTextFile(
  "docs/evidencias/seguridad-apis/tls-deno.json",
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report));
if (!report.passed) Deno.exitCode = 1;
