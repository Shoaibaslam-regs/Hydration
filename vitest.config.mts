import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside the React Server bundle; it's a no-op in tests.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Integration tests hit a real (in-memory) MongoDB; allow for slow CI machines.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    exclude: ["node_modules/**", ".next/**"],
  },
});
