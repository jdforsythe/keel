/** `<name>.store.ts` (k.store): the store; the compiler derives its id `<module>.<name>` from the export. */
export function storeTs(name: string, schema: string): string {
  return [
    "import { store } from '@keel/store'",
    `import { ${schema} } from './${schema}.schema.ts'`,
    "",
    `export const ${name} = store(${schema}, {})`,
    "",
  ].join("\n");
}
