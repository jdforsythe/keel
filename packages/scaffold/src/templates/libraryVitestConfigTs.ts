/** `vitest.config.ts` of a library: the Keel plugin under happy-dom, tests under `test/` and beside the source. */
export function libraryVitestConfigTs(): string {
  return [
    `import keel from "@keel/compiler/vite";`,
    `import { defineConfig } from "vitest/config";`,
    "",
    "export default defineConfig({",
    "  plugins: [keel()],",
    `  test: { include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"], environment: "happy-dom" },`,
    "});",
    "",
  ].join("\n");
}
