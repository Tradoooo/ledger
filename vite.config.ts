import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Root config: used by vite-node (scripts/recette.ts) and by the e2e run. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ledger/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@ledger/ui": new URL("./packages/ui/src/index.ts", import.meta.url).pathname,
    },
  },
});
