import { defineConfig } from "vitest/config";

/**
 * Default config: fast unit tests only, no Docker/DB required. Integration
 * tests live under src/integration and run via `pnpm test:integration`
 * (vitest.integration.config.ts) instead.
 */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "src/integration/**"],
  },
});
