import "dotenv/config";
import pg from "pg";
import { writeFile } from "node:fs/promises";
import { X509Certificate } from "node:crypto";
import { checkServerIdentity, rootCertificates } from "node:tls";
import {
  postgresTlsConfig,
  POSTGRES_CA,
} from "../supabase/functions/_shared/postgres-tls.mjs";
const config = postgresTlsConfig(process.env.APP_DATABASE_URL);
const report = {
  timestamp: new Date().toISOString(),
  environment: "Node local a Supabase",
  mode: "CA y hostname obligatorios",
  caFingerprint256: new X509Certificate(POSTGRES_CA).fingerprint256,
  checks: [],
};
async function probe(name, options, expectedFailure = false, expectedCodes = ["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID"]) {
  const client = new pg.Client({ ...options, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    );
    const stream = client.connection.stream;
    report.checks.push({
      name,
      connected: true,
      expectedFailure,
      passed:
        !expectedFailure &&
        stream.encrypted === true &&
        stream.authorized === true,
      clientEncrypted: Boolean(stream.encrypted),
      clientAuthorized: stream.authorized === true,
      server: result.rows,
    });
  } catch (e) {
    report.checks.push({
      name,
      connected: false,
      expectedFailure,
      passed:
        expectedFailure &&
        expectedCodes.includes(e.code),
      error: e.code || e.name,
    });
  } finally {
    await client.end();
  }
}
await probe("CA proporcionada y hostname real", config);
await probe(
  "CA ajena debe rechazarse",
  { ...config, ssl: { ...config.ssl, ca: rootCertificates[0] } },
  true
);
await probe(
  "Hostname incorrecto debe rechazarse",
  {
    ...config,
    ssl: {
      ...config.ssl,
      checkServerIdentity: (_host, cert) =>
        checkServerIdentity("incorrect-host.example.invalid", cert),
    },
  },
  true
);
await probe("Conexión sin TLS debe rechazarse", { connectionString: config.connectionString, ssl: false }, true, ["XX000", "28000"]);
await writeFile(
  "docs/evidencias/seguridad-apis/tls-probe.json",
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report));
if (report.checks.some((check) => !check.passed)) process.exitCode = 1;
