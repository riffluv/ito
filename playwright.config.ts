import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});

