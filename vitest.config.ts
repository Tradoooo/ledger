import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@ledger/core": "/packages/core/src/index.ts", "@ledger/ui": "/packages/ui/src/index.ts" } },
  test: { environment: "node", include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts", "scripts/**/*.test.mjs", "scratch/**/*.test.ts", "e2e/**/*.test.ts"], testTimeout: 20000, hookTimeout: 20000 },
});
