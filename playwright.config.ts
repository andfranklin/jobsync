import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Use a separate test database to avoid modifying production data
const testDbPath = path.resolve(__dirname, "prisma", "test-e2e.db");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.USER_EMAIL = "admin@example.com";

// Ensure the database exists with schema and seed data before the webServer
// starts. Playwright starts the webServer before globalSetup, so the DB must
// be fully ready here to prevent errors during server startup.
if (!fs.existsSync(testDbPath)) {
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    cwd: __dirname,
  });
  execSync("npm run seed", {
    stdio: "inherit",
    cwd: __dirname,
  });
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Create a fresh test database before running tests */
  globalSetup: "./e2e/global-setup.ts",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3001",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Run a separate dev server on port 3001 to avoid conflicting with dev server on 3000 */
  webServer: {
    command: "npm run dev -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
