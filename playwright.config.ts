import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.test" });

const BASE_URL = process.env.TEST_BASE_URL || "https://webagt.ai";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/*.setup.ts"],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // How many test workers (parallel browser sessions) to run
  workers: parseInt(process.env.TEST_WORKERS || "3"),
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    headless: !!process.env.CI,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
