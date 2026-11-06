/** `vite.config.ts` (k.compiler): the one Keel plugin, no options. */
export function viteConfigTs(): string {
  return ["import keel from '@keel/compiler/vite'", "", "export default { plugins: [keel()] }", ""].join("\n");
}
