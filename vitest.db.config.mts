import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { testDatabaseUrl } from "./test-db/database-url.mts";

// Database tests: *.db.test.ts files next to the code in src/, on a real PostgreSQL (pnpm test:db).
// Docker must be running (docker compose up -d). The plain unit tests (pnpm test) skip these files.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test-db/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./test-db/global-setup.ts"],
    env: { DATABASE_URL: testDatabaseUrl() },
    // All tests share one database, so test files run one after another
    fileParallelism: false,
  },
});
