/** `<name>.transaction.test.ts` (k.testing): the transaction's 100-run invariant property. `from` is the module path. */
export function transactionTest(name: string, from = "."): string {
  return [
    `import { properties } from "@keel/testing";`,
    `import { it } from "vitest";`,
    `import { ${name} } from "${from}/${name}.transaction.ts";`,
    "",
    `it("holds the store's invariants under generated payloads", async () => {`,
    `  await properties(${name}, { runs: 100 });`,
    "});",
    "",
  ].join("\n");
}
