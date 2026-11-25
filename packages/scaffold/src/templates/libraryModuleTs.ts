/** A library's root `module.ts` (k.library Kind, k.module): `id` the lowerCamel base, no deps or capabilities, `Example` public. */
export function libraryModuleTs(id: string): string {
  return [
    `import { module } from '@keel/compiler'`,
    "",
    "export default module({",
    `  id: '${id}',`,
    "  deps: [],",
    "  capabilities: [],",
    "  public: { exports: ['Example'] },",
    "})",
    "",
  ].join("\n");
}
