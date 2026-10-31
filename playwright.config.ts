import { defineConfig, devices } from "@playwright/test";

import { testDatabaseUrl } from "./e2e/test-database";

// A port of its own: the tests never reuse the app you run yourself on 3000
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // All tests share one database, so they run one after another
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The real app from a fresh build on a real database: build, empty test database, migrations, start.
  // It starts the same way as in the Docker image: the standalone server with the static files next to it.
  // Playwright starts it before the tests and stops it after them.
  webServer: {
    command: [
      "pnpm build",
      "cp -R .next/static .next/standalone/.next/",
      "pnpm exec tsx e2e/prepare-database.ts",
      "pnpm exec tsx scripts/migrate.ts",
      "node .next/standalone/server.js",
    ].join(" && "),
    url: `${baseURL}/health`,
    env: { DATABASE_URL: testDatabaseUrl(), PORT: String(PORT), HOSTNAME: "127.0.0.1" },
    // Show the build and server output: a failed build says why
    stdout: "pipe",
    // An app left running on this port may be an old build: never test it instead of the fresh one
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
