import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], fileParallelism: false },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
