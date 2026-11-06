/** `<Name>.test.tsx` (k.testing): the component's generated-props property test. `from` is the module path from the test file. */
export function componentTest(name: string, from = "."): string {
  return [
    `import { properties } from "@keel/testing";`,
    `import { it } from "vitest";`,
    `import ${name} from "${from}/${name}.tsx";`,
    "",
    `it("holds its properties", async () => {`,
    `  await properties(${name});`,
    "});",
    "",
  ].join("\n");
}
