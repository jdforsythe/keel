/** `<Name>.test.tsx` (k.testing): the component's generated-props property test. */
export function componentTest(name: string): string {
  return [
    "import { properties } from '@keel/testing'",
    "import { it } from 'vitest'",
    `import ${name} from './${name}.tsx'`,
    "",
    "it('holds its properties', async () => {",
    `  await properties(${name})`,
    "})",
    "",
  ].join("\n");
}
