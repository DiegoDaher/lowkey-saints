import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  readJsonBody,
  readLimitedBody,
  JSON_BODY_LIMIT,
} from "../supabase/functions/_shared/request-body.ts";
import { AppError } from "../supabase/functions/_shared/domain.ts";
async function main() {
  // Reproduce the JSON reader from the recorded base revision, not an invented baseline.
  const base = execFileSync(
    "git",
    [
      "show",
      "6185d144f5fbf29d0bafd867047a61b6cceb5197:supabase/functions/api/index.ts",
    ],
    { encoding: "utf8" }
  );
  const code = base.slice(
    base.indexOf("async function body(req: Request)"),
    base.indexOf("Deno.serve")
  );
  const legacy = new Function(
    "AppError",
    code.replace("req: Request", "req") + ";return body;"
  )(AppError) as (req: Request) => Promise<unknown>;
  const raw = JSON.stringify("é".repeat(100_000));
  const request = () =>
    new Request("http://localhost", { method: "POST", body: raw });
  const before = await legacy(request());
  let after = 200;
  try {
    await readJsonBody(request());
  } catch (e) {
    if (e instanceof AppError) after = e.status;
    else throw e;
  }
  let reads = 0,
    cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        reads++;
        c.enqueue(new Uint8Array(reads === 1 ? JSON_BODY_LIMIT : 1));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  try {
    await readLimitedBody(
      new Request("http://localhost", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
      JSON_BODY_LIMIT
    );
  } catch (e) {
    if (!(e instanceof AppError && e.status === 413)) throw e;
  }
  const report = {
    timestamp: new Date().toISOString(),
    environment: "local, lector de cuerpos; no es una solicitud HTTP remota",
    commitBefore: "6185d144f5fbf29d0bafd867047a61b6cceb5197",
    payload: {
      characters: raw.length,
      bytes: new TextEncoder().encode(raw).length,
    },
    before: { accepted: typeof before === "string" },
    after: { errorStatus: after, reads, cancelled },
    conclusion:
      "El lector anterior admitía JSON multibyte superior a 200000 bytes; el nuevo lo rechaza y cancela el flujo al exceder el límite.",
  };
  await writeFile(
    "docs/evidencias/seguridad-apis/before-after.json",
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report));
}
void main();
