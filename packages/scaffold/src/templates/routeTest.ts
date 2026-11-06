/** Emitted specifier, not an import of this package (kept out of the S0003 import scan). */
const TESTING = "@keel/testing";

/** `<name>.route.test.ts` (k.testing): renders the route's chain through its guards and loaders. */
export function routeTest(id: string, params: readonly string[]): string {
  const p = params.length === 0 ? "{}" : `{ ${params.map((n) => n.concat(": '1'")).join(", ")} }`;
  return [
    `import { renderRoute } from '${TESTING}'`,
    "import { expect, it } from 'vitest'",
    "",
    "it('renders its chain', async () => {",
    `  const page = await renderRoute('${id}', { params: ${p} })`,
    "  expect(page.a11y()).toBeDefined()",
    "})",
    "",
  ].join("\n");
}
