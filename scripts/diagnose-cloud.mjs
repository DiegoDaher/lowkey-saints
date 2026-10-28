import "dotenv/config";
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const response = await fetch(base + "/functions/v1/api/v1/categories", {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  signal: AbortSignal.timeout(30000),
});
console.log("catalog", response.status, (await response.text()).slice(0, 2000));
const url = new URL(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/analytics/endpoints/logs`);
url.searchParams.set("sql", "select timestamp, event_message from logs where source = 'function_logs' order by timestamp desc limit 10");
url.searchParams.set("iso_timestamp_start", new Date(Date.now() - 30 * 60000).toISOString());
url.searchParams.set("iso_timestamp_end", new Date().toISOString());
const logs = await fetch(url, {headers: {Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN}});
let output = await logs.text();
for (const [key, value] of Object.entries(process.env)) {
  if (/(SECRET|TOKEN|KEY|DATABASE_URL|DIRECT_URL)/.test(key) && value?.length > 8) output = output.replaceAll(value, "[REDACTED]");
}
console.log("logs", logs.status, output.slice(0, 12000));
