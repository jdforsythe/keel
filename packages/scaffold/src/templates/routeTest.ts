/** `<name>.route.test.ts` (k.testing): renders the route's chain from the module's manifest. */
export function routeTest(id: string, params: readonly string[]): string {
  const p = params.length === 0 ? "{}" : `{ ${params.map((n) => n.concat(": '1'")).join(", ")} }`;
  return [
    "import { renderRoute } from '@keel/testing'",
    "import { expect, it } from 'vitest'",
    "import { routes } from './routes.ts'",
    "",
    "it('renders its chain', async () => {",
    `  const page = await renderRoute('${id}', { routes, params: ${p} })`,
    `  expect(page.route().id).toBe('${id}')`,
    "  page.dispose()",
    "})",
    "",
  ].join("\n");
}
