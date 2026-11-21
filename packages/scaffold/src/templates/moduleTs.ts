/** `modules/<id>/module.ts` (k.module): a manifest with no deps, capabilities, or exports; its routes are its contract's. */
export function moduleTs(id: string): string {
  return [
    `import { module } from "@keel/compiler";`,
    "",
    "export default module({",
    `  id: "${id}",`,
    "  deps: [],",
    "  capabilities: [],",
    "  public: { exports: [] },",
    "});",
    "",
  ].join("\n");
}
