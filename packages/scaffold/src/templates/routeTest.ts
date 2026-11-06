/** `<mod>.<name>.route.test.ts` (k.testing): renders the route's chain. `routes` is the import specifier of the module's manifest. */
export function routeTest(id: string, params: readonly string[], routes = "./routes.ts"): string {
  const p = params.length === 0 ? "{}" : `{ ${params.map((n) => n.concat(': "1"')).join(", ")} }`;
  return [
    `import { renderRoute } from "@keel/testing";`,
    `import { expect, it } from "vitest";`,
    `import { routes } from "${routes}";`,
    "",
    `it("renders its chain", async () => {`,
    `  const page = await renderRoute("${id}", { routes, params: ${p} });`,
    `  expect(page.route().id).toBe("${id}");`,
    "  page.dispose();",
    "});",
    "",
  ].join("\n");
}
