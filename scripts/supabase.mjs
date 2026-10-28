import "dotenv/config";
import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/supabase/dist/supabase.js", ...process.argv.slice(2)],
  { stdio: "inherit" }
);
process.exit(result.status ?? 1);
