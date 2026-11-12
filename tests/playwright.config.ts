import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.browser.spec.ts",
  use: {
    baseURL: "http://localhost:3102",
    browserName: "chromium",
    channel: "chrome",
  },
  reporter: "list",
  webServer: [
    {
      command: "node tests/auth-fixture.mjs",
      cwd: "..",
      url: "http://127.0.0.1:55440/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 3102",
      cwd: "..",
      url: "http://localhost:3102",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55440",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "browser-test-only",
      },
    },
  ],
});
