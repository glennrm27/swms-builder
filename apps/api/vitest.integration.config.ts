import { defineConfig } from "vitest/config";

/**
 * Integration tests spin up a real Postgres container (testcontainers) and
 * exercise the API over HTTP with supertest — requires Docker. Run via
 * `pnpm --filter @swms/api test:integration`.
 */
export default defineConfig({
  test: {
    include: ["src/integration/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
