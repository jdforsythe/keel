/** `vitest.config.ts` of a workspace project: happy-dom, the Keel plugin, the Keel reporter, tests under `test/`. */
export function vitestConfigTs(): string {
  return [
    `import keel from "@keel/compiler/vite";`,
    `import { KeelReporter } from "@keel/tooling/vitest-reporter";`,
    `import { defineConfig } from "vitest/config";`,
    "",
    "export default defineConfig({",
    "  plugins: [keel()],",
    "  test: {",
    `    include: ["test/**/*.test.{ts,tsx}"],`,
    `    environment: "happy-dom",`,
    "    reporters: [new KeelReporter()],",
    "  },",
    "});",
    "",
  ].join("\n");
}
