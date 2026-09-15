import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 3100;
const API_PORT = 3101;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @hrms/api start:dev",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: "../..",
      env: {
        PORT: String(API_PORT),
        NODE_ENV: "test",
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          "postgresql://hrms_app:changeme@localhost:5433/hrms_test?schema=public",
        REDIS_URL: process.env.E2E_REDIS_URL ?? "redis://localhost:6379/3",
        JWT_ACCESS_SECRET: "playwright-access-secret-aaaaaaaaaaaaaaaaaaaaaaaa",
        JWT_REFRESH_SECRET: "playwright-refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbb",
        COOKIE_SECRET: "playwright-cookie-secret",
        PAYMENT_WEBHOOK_SECRET: "playwright-webhook-secret",
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        DISABLE_RATE_LIMITING: "true",
      },
    },
    {
      command: "pnpm --filter @hrms/web dev -p " + WEB_PORT,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: "../..",
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
