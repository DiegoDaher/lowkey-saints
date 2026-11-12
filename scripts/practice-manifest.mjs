import "dotenv/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const dir = "docs/evidencias/seguridad-apis";
const entries = (await readdir(dir))
  .filter((name) => name !== "manifest.json")
  .sort();
const sources = [
  "docs/prod-ca-2021.crt",
  "supabase/functions/_shared/postgres-tls.mjs",
  "supabase/functions/_shared/db.ts",
  "tests/postgres-tls.test.ts",
  "supabase/functions/_shared/request-body.ts",
  "supabase/functions/api/index.ts",
  "tests/request-body.test.ts",
  "README.md",
  "docs/seguridad-apis.md",
  "docs/entregables/Lowkey_Saints_Seguridad_APIs_Despliegue.docx",
];
const secrets = Object.entries(process.env).filter(
  ([name, value]) =>
    /SECRET|PASSWORD|ACCESS_TOKEN|DATABASE_URL|RESEND_API_KEY/.test(name) &&
    value &&
    value.length > 7
);
const files = [];
for (const path of [...entries.map((name) => dir + "/" + name), ...sources]) {
  const content = await readFile(path);
  if (/\.(json|md|ts|mjs)$/.test(path)) {
    for (const [name, value] of secrets)
      if (content.toString("utf8").includes(value))
        throw new Error("Secret value found: " + name + " in " + path);
  }
  files.push({
    path,
    bytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}
await writeFile(
  dir + "/manifest.json",
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      improvementCommit: "1f8d45092ecf9c501aa50a615cdece19c1d0cbec",
      tlsCommit: "654ee23",
      commitAtCapture: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      secretScan: "No configured private values found in checked text files",
      files,
    },
    null,
    2
  )
);
console.log("Manifest generated; secret scan passed");
