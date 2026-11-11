import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const dir = "docs/evidencias/seguridad-apis";
await mkdir(dir, { recursive: true });
const commands = {
  unit: [
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    "tests/domain.test.ts",
    "tests/request-body.test.ts",
  ],
  edge: [
    "node_modules/deno/bin.cjs",
    "check",
    "--config",
    "supabase/functions/deno.json",
    "supabase/functions/api/index.ts",
    "supabase/functions/jobs/index.ts",
  ],
  types: ["node_modules/typescript/bin/tsc", "--noEmit"],
  lint: ["node_modules/eslint/bin/eslint.js"],
  build: ["node_modules/next/dist/bin/next", "build"],
  integration: ["scripts/test-integration.mjs"],
  browser: [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "tests/playwright.config.ts",
  ],
};
const selected = process.argv.slice(2);
for (const name of selected) {
  const args = commands[name];
  if (!args) throw new Error("Unknown check");
  const timestamp = new Date().toISOString();
  let output = "";
  const child = spawn(process.execPath, args, {
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  child.stdout.on("data", (data) => (output += data));
  child.stderr.on("data", (data) => (output += data));
  const code = await new Promise((resolve) => {
    child.on("error", (e) => {
      output += e.code;
      resolve(-1);
    });
    child.on("close", resolve);
  });
  const report = {
    timestamp,
    environment: "local",
    commitBase: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    command: "node " + args.join(" "),
    exitCode: code,
    output,
  };
  await writeFile(
    dir + "/" + name + ".json",
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(name + ": exit " + code + "\n" + output.slice(-1600));
}
