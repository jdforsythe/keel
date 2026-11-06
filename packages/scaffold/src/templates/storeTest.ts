/** `<name>.store.test.ts`: the store's invariant test (its state always parses with its schema). */
export function storeTest(name: string, schema: string): string {
  return [
    "import { expect, it } from 'vitest'",
    `import { ${schema} } from './${schema}.schema.ts'`,
    `import { ${name} } from './${name}.store.ts'`,
    "",
    "it('holds its invariants in the initial state', () => {",
    `  expect(${schema}.parse(${name}.snapshot().state).ok).toBe(true)`,
    "})",
    "",
  ].join("\n");
}
