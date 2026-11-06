/** Emitted specifier, not an import of this package (kept out of the S0003 import scan). */
const TESTING = "@keel/testing";

/** `<Name>.test.tsx` (k.testing): the component's generated-props property test. */
export function componentTest(name: string): string {
  return [
    `import { properties } from '${TESTING}'`,
    "import { it } from 'vitest'",
    `import ${name} from './${name}.tsx'`,
    "",
    "it('holds its properties', async () => {",
    `  await properties(${name})`,
    "})",
    "",
  ].join("\n");
}
