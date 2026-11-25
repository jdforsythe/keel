// k.library Ids, a library's route component: a file a `manifest(` call of `@keel/router` in the same library binds as
// a route's `component` (a relative default import), whose stem `public.exports` does not list and which no `exports`
// entry gives, may give an element the literal id `<id>.<rest>`, `<id>` the library's manifest id. Any other prefix,
// the bare id, a widget file the table binds nothing from, a public page and an app's import of another library's
// page stay E1161.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/status";
const manifest = (id: string, deps: string[], exports: string[] = []) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: ${JSON.stringify(exports).replaceAll('"', "'")} } })\n`;
const PKG = (exports: Record<string, string> = {}) =>
  JSON.stringify({
    name: "@acme/status",
    version: "1.0.0",
    type: "module",
    keel: "library",
    exports: { ".": "./src/index.ts", ...exports },
  });
const page = (id: string) =>
  `import { Box } from '@keel/ui'\nexport default function StatusView(): Node {\n  return Box({ as: 'main', id: ${JSON.stringify(id)} })\n}\n`;
const jsxPage = (id: string) =>
  `import { Box } from '@keel/ui'\nexport default function StatusView() {\n  return <Box as="main" id="${id}" />\n}\n`;
const ROUTES =
  "import { manifest } from '@keel/router'\nimport StatusView from './StatusView.ts'\nimport { status } from './status.contract.ts'\nexport const routes = manifest(status, { 'status.page': { component: StatusView } })\n";

const e1161 = (files: Record<string, string>, opts: { exports?: string[]; pkg?: Record<string, string> } = {}) =>
  check(
    [
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/status"]) },
      { path: `${LIB}/package.json`, source: PKG(opts.pkg) },
      { path: `${LIB}/module.ts`, source: manifest("status", [], opts.exports ?? ["routes"]) },
      ...Object.entries(files).map(([p, source]) => ({ path: `${LIB}/${p}`, source })),
    ],
    { types: false },
  )
    .diagnostics.filter((d) => d.code === "E1161")
    .map((d) => d.path);

it("a route component's literal id under the library's id is no E1161, as a call or as JSX", () => {
  expect(e1161({ "src/StatusView.ts": page("status.page"), "src/routes.ts": ROUTES })).toEqual([]);
  expect(
    e1161({ "src/StatusView.tsx": jsxPage("status.page.main"), "src/routes.ts": ROUTES.replace(".ts'", ".tsx'") }),
  ).toEqual([]);
});

it("another prefix, the bare id and an id ending at the dot are each E1161", () => {
  for (const id of ["shop.page", "status", "status.", "statusx.page"])
    expect(e1161({ "src/StatusView.ts": page(id), "src/routes.ts": ROUTES }), id).toEqual([`${LIB}/src/StatusView.ts`]);
});

it("a file no route binds keeps the props-id rule", () => {
  expect(e1161({ "src/StatusView.ts": page("status.page") })).toEqual([`${LIB}/src/StatusView.ts`]);
});

it("a route component the library makes public, or an entry gives, keeps the props-id rule", () => {
  const files = { "src/StatusView.ts": page("status.page"), "src/routes.ts": ROUTES };
  expect(e1161(files, { exports: ["routes", "StatusView"] })).toEqual([`${LIB}/src/StatusView.ts`]);
  expect(e1161(files, { pkg: { "./view": "./src/StatusView.ts" } })).toEqual([`${LIB}/src/StatusView.ts`]);
});

it("a spread after the literal id, and an element in a helper file the page imports, are E1161", () => {
  const spread = `import { Box } from '@keel/ui'\nexport default function StatusView(): Node {\n  return Box({ id: 'status.page', ...extra })\n}\nconst extra = { id: 'box' }\n`;
  expect(e1161({ "src/StatusView.ts": spread, "src/routes.ts": ROUTES })).toEqual([`${LIB}/src/StatusView.ts`]);
  const helper =
    "import { Box } from '@keel/ui'\nexport function part(): Node {\n  return Box({ id: 'status.part' })\n}\n";
  expect(e1161({ "src/StatusView.ts": page("status.page"), "src/routes.ts": ROUTES, "src/part.ts": helper })).toEqual([
    `${LIB}/src/part.ts`,
  ]);
});
