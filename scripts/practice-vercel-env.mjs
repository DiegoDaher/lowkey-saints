import "dotenv/config";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { writeFile } from "node:fs/promises";
const cli =
  homedir() + "/AppData/Roaming/npm/node_modules/vercel/dist/index.js";
const checks = [];
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]) {
  if (!process.env[name]) throw new Error("Missing " + name);
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "env",
      "add",
      name,
      "production",
      "--force",
      "--yes",
      "--no-sensitive",
    ],
    { input: process.env[name], encoding: "utf8", timeout: 30000 }
  );
  checks.push({ name, environment: "production", exitCode: result.status });
}
await writeFile(
  "docs/evidencias/seguridad-apis/vercel-env.json",
  JSON.stringify({ timestamp: new Date().toISOString(), checks }, null, 2)
);
console.log(JSON.stringify(checks));
