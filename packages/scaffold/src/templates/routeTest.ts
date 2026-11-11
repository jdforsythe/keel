/**
 * `<mod>.<name>.route.test.ts` (k.testing): renders the route's chain. `routes` is the import specifier of the module's manifest.
 * `apiPath` (k.api): the route is an API route with no view, so the test requests that path of the app and expects JSON.
 */
export function routeTest(
  id: string,
  params: readonly string[],
  routes = "./routes.ts",
  apiPath: string | null = null,
): string {
  const p = params.length === 0 ? "{}" : `{ ${params.map((n) => n.concat(': "1"')).join(", ")} }`;
  if (apiPath !== null) {
    const local = routes.startsWith("./");
    const at = [
      `import { routes } from "${routes}";`,
      `import topology from "${local ? "../../" : "../"}topology.ts";`,
    ];
    return [
      "// @vitest-environment node",
      `import { createCtx } from "@keel/ctx";`,
      `import { createApp } from "@keel/server";`,
      `import { expect, it } from "vitest";`,
      ...(local ? at.reverse() : at),
      "",
      `it("answers JSON", async () => {`,
      `  const app = await createApp({ topology, routes, ctx: createCtx({ mode: "sim", seed: 1337 }) });`,
      `  const res = await app.fetch(new Request("http://localhost${apiPath.replace(/:[^/]+/g, "1")}"));`,
      `  expect(await res.json()).toMatchObject({ id: "${id}" });`,
      "});",
      "",
    ].join("\n");
  }
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
