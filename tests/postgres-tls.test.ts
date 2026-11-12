import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { X509Certificate } from "node:crypto";
import pg from "pg";
import {
  postgresTlsConfig,
  POSTGRES_CA,
} from "../supabase/functions/_shared/postgres-tls.mjs";

test("TLS trust anchor matches the supplied CA and is currently valid", async () => {
  assert.equal(
    POSTGRES_CA,
    (await readFile("docs/prod-ca-2021.crt", "utf8")).trim()
  );
  const cert = new X509Certificate(POSTGRES_CA);
  assert.equal(cert.ca, true);
  assert.ok(Date.parse(cert.validFrom) <= Date.now());
  assert.ok(Date.parse(cert.validTo) > Date.now());
});

test("URL options cannot override the explicit CA and strict validation in pg", () => {
  const config = postgresTlsConfig(
    "postgresql://user:pass@example.com/db?sslmode=disable&sslrootcert=missing&sslcert=missing&sslkey=missing&ssl=false&uselibpqcompat=true&application_name=test"
  );
  const client = new pg.Client(config);
  assert.deepEqual(client.ssl, {
    ca: POSTGRES_CA,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
  assert.equal(
    new URL(config.connectionString).searchParams.get("application_name"),
    "test"
  );
  assert.deepEqual(
    [...new URL(config.connectionString).searchParams.keys()],
    ["application_name"]
  );
});
