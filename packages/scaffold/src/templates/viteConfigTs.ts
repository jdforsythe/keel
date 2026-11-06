/** `vite.config.ts` (k.compiler): the one Keel plugin, no options. */
export function viteConfigTs(): string {
  return [
    `import keel from "@keel/compiler/vite";`,
    `import { defineConfig } from "vite";`,
    "",
    "export default defineConfig({ plugins: [keel()] });",
    "",
  ].join("\n");
}
