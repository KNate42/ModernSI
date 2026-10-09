// End-to-end tests against the real backend and worker on the test stores (infra/docker-compose.test.yml).
// Do not run at the same time as backend pytest: both use the same test stores.
// CHROMIUM_PATH points at a ready browser when the bundled one is not installed.
// This work made by Anfinogentov Nikita
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "sh tests/e2e/start-backend.sh", url: "http://localhost:8100/api/health", timeout: 180_000, reuseExistingServer: false },
    { command: "npm run build && npm run start -- --port 3100", url: "http://localhost:3100", timeout: 300_000, reuseExistingServer: false, env: { API_URL: "http://localhost:8100" } },
  ],
});
