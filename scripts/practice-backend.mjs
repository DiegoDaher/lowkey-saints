import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Missing project reference");
const mode = process.argv[2];
const root = resolve("out/practice-backend-before");
await mkdir(root, { recursive: true });
const args =
  mode === "backup"
    ? [
        "functions",
        "download",
        "api",
        "--project-ref",
        ref,
        "--workdir",
        root,
        "--use-api",
      ]
    : mode === "cors"
      ? [
          "secrets",
          "set",
          "ALLOWED_ORIGINS=" +
            [
              ...new Set([
                ...(
                  process.env.ALLOWED_ORIGINS || "http://localhost:3000"
                ).split(","),
                "https://lowkey-saints.vercel.app",
              ]),
            ].join(","),
          "--project-ref",
          ref,
        ]
      : mode === "deploy"
        ? ["functions", "deploy", "api", "--project-ref", ref, "--use-api"]
        : ["functions", "deploy", "--help"];
const env = { ...process.env };
if (process.argv.includes("--cli-session")) delete env.SUPABASE_ACCESS_TOKEN;
await mkdir("out/practice-cli", { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/supabase/dist/supabase.js"),
    ...args,
    ...(mode === "deploy" ? ["--workdir", process.cwd()] : []),
  ],
  { env, cwd: resolve("out/practice-cli"), encoding: "utf8", timeout: 120000 }
);
const output = (result.stdout || "") + (result.stderr || "");
if (["backup", "deploy", "cors"].includes(mode))
  await writeFile(
    "docs/evidencias/seguridad-apis/backend-" + mode + ".json",
    JSON.stringify(
      { timestamp: new Date().toISOString(), exitCode: result.status, output },
      null,
      2
    )
  );
console.log(output);
process.exitCode = result.status ?? 1;
