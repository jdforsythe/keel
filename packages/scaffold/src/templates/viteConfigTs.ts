/**
 * `vite.config.ts` (k.compiler): the one Keel plugin, no options. Vitest reads it too, so `keel test` renders
 * components and routes under happy-dom (RFC 0036); a workspace project's `vitest.config.ts` takes precedence.
 */
export function viteConfigTs(): string {
  return [
    `import keel from "@keel/compiler/vite";`,
    `import { defineConfig } from "vitest/config";`,
    "",
    `export default defineConfig({ plugins: [keel()], test: { environment: "happy-dom" } });`,
    "",
  ].join("\n");
}
