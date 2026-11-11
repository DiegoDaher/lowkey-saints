import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const mode = process.argv[2] || "status";
const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref || !process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error("Missing Supabase configuration");
const evidence = "docs/evidencias/seguridad-apis";
const endpoint =
  "https://api.supabase.com/v1/projects/" + ref + "/ssl-enforcement";
async function enforcement(method = "GET") {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    ...(method === "PUT"
      ? { body: JSON.stringify({ requestedConfig: { database: true } }) }
      : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("SSL enforcement HTTP " + response.status);
  return response.json();
}
if (mode === "status" || mode === "enable") {
  const before = await enforcement();
  let after = before;
  if (mode === "enable" && !before.currentConfig?.database) {
    await enforcement("PUT");
    for (let attempt = 0; attempt < 24; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      after = await enforcement();
      if (after.currentConfig?.database && after.appliedSuccessfully) break;
    }
  }
  const report = { timestamp: new Date().toISOString(), mode, before, after };
  await writeFile(
    evidence + "/tls-enforcement.json",
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report));
  if (
    mode === "enable" &&
    (!after.currentConfig?.database || !after.appliedSuccessfully)
  )
    process.exitCode = 1;
} else if (mode === "backup" || mode === "deploy") {
  const workdir =
    mode === "backup" ? resolve("out/postgres-tls-before") : process.cwd();
  await mkdir(workdir, { recursive: true });
  const runs = [];
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
        output = output.replaceAll(value, "[OCULTO]");
    runs.push({ function: name, exitCode: result.status, output });
    if (result.status !== 0) break;
  }
  await writeFile(
    evidence + "/tls-" + mode + ".json",
    JSON.stringify({ timestamp: new Date().toISOString(), runs }, null, 2)
  );
  console.log(JSON.stringify(runs));
  if (runs.some((run) => run.exitCode !== 0)) process.exitCode = 1;
} else throw new Error("Expected status, enable, backup or deploy");
