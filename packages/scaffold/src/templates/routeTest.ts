/** The `new Request(...)` of an API route's test: a write sends an empty JSON body. */
function request(api: { path: string; method: string }): string {
  const url = `"http://localhost${api.path.replace(/:[^/]+/g, "1")}"`;
  if (api.method === "GET") return `new Request(${url})`;
  return `new Request(${url}, { method: "${api.method}", headers: { "content-type": "application/json" }, body: "{}" })`;
}

/**
 * `<mod>.<name>.route.test.ts` (k.testing): renders the route's chain. `routes` is the import specifier of the module's manifest.
 * `api` (k.api): the route is an API route with no view, so the test serves the module alone from a node
 * deployable, requests that path with that method and expects JSON. `node`: a page a `node` deployable serves, so the
 * test serves the module alone from one and renders the page from that app (`renderRoute` with `app`).
 */
export function routeTest(
  id: string,
  params: readonly string[],
  routes = "./routes.ts",
  api: { path: string; method: string } | null = null,
  node = false,
): string {
  const p = params.length === 0 ? "{}" : `{ ${params.map((n) => n.concat(': "1"')).join(", ")} }`;
  if (api !== null) {
    const mod = id.split(".")[0] ?? id;
    return [
      "// @vitest-environment node",
      `import { createCtx } from "@keel/ctx";`,
      `import { createApp, topology } from "@keel/server";`,
      `import { expect, it } from "vitest";`,
      `import { routes } from "${routes}";`,
      "",
      "// The module alone, in a node deployable: an API route needs a server.",
      `const served = topology({ api: { modules: ["${mod}"], adapter: "node" } });`,
      "",
      `it("answers JSON", async () => {`,
      `  const app = await createApp({ topology: served, routes, ctx: createCtx({ mode: "sim", seed: 1337 }) });`,
      `  const res = await app.fetch(${request(api)});`,
      `  expect(await res.json()).toMatchObject({ id: "${id}" });`,
      "});",
      "",
    ].join("\n");
  }
  if (node) {
    const mod = id.split(".")[0] ?? id;
    return [
      `import { createCtx } from "@keel/ctx";`,
      `import { createApp, topology } from "@keel/server";`,
      `import { renderRoute } from "@keel/testing";`,
      `import { expect, it } from "vitest";`,
      `import { routes } from "${routes}";`,
      "",
      "// The module alone, in a node deployable: the page is rendered as that deployable serves it.",
      `const served = topology({ web: { modules: ["${mod}"], adapter: "node" } });`,
      "",
      `it("renders its chain", async () => {`,
      `  const ctx = createCtx({ mode: "sim", seed: 1337 });`,
      "  const app = await createApp({ topology: served, routes, ctx });",
      `  const page = await renderRoute("${id}", { routes, params: ${p}, app, ctx });`,
      `  expect(page.route().id).toBe("${id}");`,
      "  page.dispose();",
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
