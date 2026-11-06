/** `<name>.store.test.ts`: the store's invariant test (its state always parses with its schema). `from` is the module path from the test file. */
export function storeTest(name: string, schema: string, from = "."): string {
  return [
    `import { expect, it } from "vitest";`,
    `import { ${schema} } from "${from}/${schema}.schema.ts";`,
    `import { ${name} } from "${from}/${name}.store.ts";`,
    "",
    `it("holds its invariants in the initial state", () => {`,
    `  expect(${schema}.parse(${name}.snapshot().state).ok).toBe(true);`,
    "});",
    "",
  ].join("\n");
}
