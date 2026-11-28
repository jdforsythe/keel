/** `vitest.config.ts` of a workspace project: happy-dom, the Keel plugin, the Keel reporter and test watchdog (`keelConfig`), tests under `test/`, module tests, and session jobs under `.keel/sessions/`. */
export function vitestConfigTs(): string {
  return [
    `import keel from "@keel/compiler/vite";`,
    `import { keelConfig } from "@keel/tooling/vitest-config";`,
    "",
    "export default keelConfig({",
    "  plugins: [keel()],",
    "  test: {",
    `    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],`,
    `    environment: "happy-dom",`,
    "  },",
    "});",
    "",
  ].join("\n");
}
