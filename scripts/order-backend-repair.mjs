import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const mode = process.argv[2];
if (!["backup", "deploy"].includes(mode))
  throw new Error("Expected backup or deploy");
const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref || !process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error("Missing Supabase configuration");
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") !==
  `https://${ref}.supabase.co`
)
  throw new Error("Project URL and reference do not match");
const workdir =
  mode === "backup"
    ? resolve("out/order-backend-before-" + Date.now())
    : process.cwd();
mkdirSync(workdir, { recursive: true });
for (const name of ["api", "jobs"]) {
  const result = spawnSync(
    process.execPath,
    [
      resolve("node_modules/supabase/dist/supabase.js"),
      "functions",
      mode === "backup" ? "download" : "deploy",
      name,
      "--project-ref",
      ref,
      "--workdir",
      workdir,
      "--use-api",
    ],
    { encoding: "utf8", timeout: 120000 }
  );
  let output = (result.stdout || "") + (result.stderr || "");
  for (const [key, value] of Object.entries(process.env))
    if (
      /SECRET|TOKEN|PASSWORD|DATABASE_URL|DIRECT_URL/.test(key) &&
      value?.length > 7
    )
      output = output.replaceAll(value, "[REDACTED]");
  console.log(output);
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(JSON.stringify({ mode, workdir }));
