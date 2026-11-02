import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    env: {
      PGLITE_DATA_DIR: "memory",
      USE_PGLITE: "true",
      MODEL_MODE: "mock",
      LOG_LEVEL: "error",
    },
  },
});
