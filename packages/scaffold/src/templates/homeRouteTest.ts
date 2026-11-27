/**
 * `modules/app/home.route.test.ts` of a new project (k.create Files): renders `app.home` (from the module served by a
 * `node` deployable when `node`, k.testing), expects the heading `app.home.title` to read the project's name, and reads
 * it through `a11y()`, so the first `keel test` is a real test of the page a person sees.
 */
export function homeRouteTest(name: string, node: boolean): string {
  const head = node
    ? [
        `import { createCtx } from "@keel/ctx";`,
        `import { createApp, topology } from "@keel/server";`,
        `import { renderRoute } from "@keel/testing";`,
        `import { expect, it } from "vitest";`,
        `import { routes } from "./routes.ts";`,
        "",
        "// The module alone, in a node deployable: the page is rendered as that deployable serves it.",
        `const served = topology({ web: { modules: ["app"], adapter: "node" } });`,
        "",
      ]
    : [
        `import { renderRoute } from "@keel/testing";`,
        `import { expect, it } from "vitest";`,
        `import { routes } from "./routes.ts";`,
        "",
      ];
  const render = node
    ? [
        `  const ctx = createCtx({ mode: "sim", seed: 1337 });`,
        "  const app = await createApp({ topology: served, routes, ctx });",
        `  const page = await renderRoute("app.home", { routes, params: {}, app, ctx });`,
      ]
    : [`  const page = await renderRoute("app.home", { routes, params: {} });`];
  return [
    ...head,
    `it("shows the project's name as the home page's heading", async () => {`,
    ...render,
    `  expect(page.find("app.home.title").text).toBe("${name}");`,
    `  expect(page.a11y("app.home.title")).toMatchObject({ role: "heading", name: "${name}" });`,
    "  page.dispose();",
    "});",
    "",
  ].join("\n");
}
