import "dotenv/config";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
const names = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "APP_DATABASE_URL",
  "DIRECT_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "VERCEL_TOKEN",
  "SITE_URL",
  "RESEND_API_KEY",
];
console.log(
  JSON.stringify(
    {
      configured: Object.fromEntries(
        names.map((k) => [k, Boolean(process.env[k])])
      ),
      vercelAuth: [
        homedir() + "/AppData/Roaming/com.vercel.cli/auth.json",
        homedir() + "/AppData/Local/com.vercel.cli/auth.json",
      ].some(existsSync),
    },
    null,
    2
  )
);
