import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "docs/evidencias/seguridad-apis/sistema-local.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "docs/evidencias/seguridad-apis/login-local.png",
  });
  console.log(
    "Screenshots saved; admin redirects to " + new URL(page.url()).pathname
  );
} finally {
  await browser.close();
}
