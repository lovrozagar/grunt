import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts", "cli/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["cli/**", "scripts/grunt-config.mjs"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
