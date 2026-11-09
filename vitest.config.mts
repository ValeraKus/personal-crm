import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

// Unit tests: *.test.ts files next to the code in src/.
// The browser tests in e2e/ are not here: Playwright runs them (pnpm test:e2e).
// The *.db.test.ts files need a database: they run separately (pnpm test:db).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "src/**/*.db.test.ts"],
  },
});
