import "dotenv/config";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { writeFile } from "node:fs/promises";
const cli =
  homedir() + "/AppData/Roaming/npm/node_modules/vercel/dist/index.js";
const args = [cli, "deploy", "--yes", "--prod", "--name", "lowkey-saints"];
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]) {
  if (!process.env[name]) throw new Error("Missing " + name);
  args.push(
    "--env",
    name + "=" + process.env[name],
    "--build-env",
    name + "=" + process.env[name]
  );
}
const result = spawnSync(process.execPath, args, {
  encoding: "utf8",
  timeout: 300000,
});
let output = (result.stdout || "") + (result.stderr || "");
for (const name of [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
])
  if (process.env[name])
    output = output.replaceAll(process.env[name], "[OCULTO]");
await writeFile(
  "docs/evidencias/seguridad-apis/vercel-deploy.json",
  JSON.stringify(
    { timestamp: new Date().toISOString(), exitCode: result.status, output },
    null,
    2
  )
);
console.log(output);
process.exitCode = result.status ?? 1;
