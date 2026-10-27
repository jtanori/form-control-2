import { defineConfig } from "@playwright/test";

/**
 * INTE-001 — extension E2E.
 * Launches Chromium with `extensions/browser/dist` loaded; mock Core + fixture
 * static server come from `webServer`. `repeatEach: 5` satisfies the
 * "passes 5 times continuously" acceptance criterion.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  repeatEach: Number(process.env.E2E_REPEAT ?? 5),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: "node mock-core.mjs",
      url: "http://127.0.0.1:8020/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: "node static-server.mjs",
      url: "http://127.0.0.1:4173/tests/fixtures/form-checkout.html",
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
});
