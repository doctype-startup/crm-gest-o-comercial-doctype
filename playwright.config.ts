import { defineConfig, devices } from "@playwright/test";
import chromium from "@sparticuz/chromium";
import { randomUUID } from "node:crypto";

const dbUrl = `sqlite:/tmp/doctype-os-e2e-${randomUUID()}.db`;
chromium.setGraphicsMode = false;
const executablePath = await chromium.executablePath();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3010", trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions: { executablePath, args: chromium.args } },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3010",
    url: "http://127.0.0.1:3010/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: dbUrl, DATABASE_ENGINE: "sqlite", SEED_ADMIN_EMAIL: "admin@doctype.local", SEED_ADMIN_PASSWORD: "Doctype@2026", SEED_ADMIN_NAME: "NAY" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { viewport: { width: 390, height: 844 } } }],
});
