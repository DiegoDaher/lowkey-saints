import "dotenv/config";
import { writeFile } from "node:fs/promises";
import tls from "node:tls";
import { chromium } from "@playwright/test";
const site = "https://lowkey-saints.vercel.app";
const checks = [];
for (const path of ["/", "/admin"]) {
  const response = await fetch(site + path, { redirect: "manual" });
  checks.push({
    request: site + path,
    status: response.status,
    location: response.headers.get("location"),
  });
}
const api = await fetch(
  process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/api/v1/products",
  {
    headers: {
      Origin: site,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
  }
);
checks.push({
  request: "GET /products con Origin Vercel",
  status: api.status,
  allowOrigin: api.headers.get("access-control-allow-origin"),
});
const certificate = await new Promise((resolve, reject) => {
  const host = new URL(site).hostname;
  const socket = tls.connect(
    { host, port: 443, servername: host, rejectUnauthorized: true },
    () => {
      const cert = socket.getPeerCertificate();
      resolve({
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        issuer: cert.issuer?.O,
      });
      socket.end();
    }
  );
  socket.on("error", reject);
  socket.setTimeout(15000, () => socket.destroy(new Error("timeout")));
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(site, { waitUntil: "networkidle" });
  await page.screenshot({
    path: "docs/evidencias/seguridad-apis/sistema-vercel.png",
  });
} finally {
  await browser.close();
}
const report = {
  timestamp: new Date().toISOString(),
  site,
  checks,
  certificate,
};
await writeFile(
  "docs/evidencias/seguridad-apis/publication.json",
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report));
