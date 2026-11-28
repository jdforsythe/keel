// k.library-pages: a page is a route component only when nothing but its one binding reaches it. Every way a file of
// the project can reach the page counts as the bundler resolves it: a directory index, a `?query`, a template with no
// substitution, `require`, a re-export, another library's or an app's relative path, an `exports` pattern; and a
// computed `import()`, `require` or `import.meta.glob` in the library names every file of it.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[], exports: string[] = []) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: ${JSON.stringify(exports).replaceAll('"', "'")} } })\n`;
const PKG = (exports: Record<string, string> = {}) =>
  JSON.stringify({
    name: "@acme/charts",
    version: "1.0.0",
    type: "module",
    keel: "library",
    exports: { ".": "./src/index.ts", "./routes": "./src/routes.ts", ...exports },
  });
const PAGE =
  "import { Box } from '@keel/ui'\nexport default function Page() {\n  return Box({ id: 'charts.page' })\n}\n";
const routes = (spec = "./Page.ts", table = "{ 'charts.page': { component: Page } }") =>
  `import { manifest } from '@keel/router'\nimport Page from '${spec}'\nimport { charts } from './charts.contract.ts'\nexport const routes = manifest(charts, ${table})\n`;
const CONTRACT =
  "import { contract } from '@keel/router/contract'\nexport const charts = contract('charts', { 'charts.page': { path: '/charts' } })\n";

type Tree = Record<string, string>;
/** The E1161 paths of an app listing `@acme/charts`, with `lib` beside its manifest and `app` among the app's files. */
const e1161 = (lib: Tree, app: Tree = {}, pkg: Record<string, string> = {}) =>
  check(
    [
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"]) },
      { path: `${LIB}/package.json`, source: PKG(pkg) },
      { path: `${LIB}/module.ts`, source: manifest("charts", [], ["routes"]) },
      ...Object.entries(app).map(([path, source]) => ({ path, source })),
      ...Object.entries({ "src/index.ts": "export { routes } from './routes.ts'\n", ...lib }).map(([p, source]) => ({
        path: `${LIB}/${p}`,
        source,
      })),
    ],
    { types: false },
  )
    .diagnostics.filter((d) => d.code === "E1161")
    .map((d) => d.path);

const base: Tree = { "src/Page.ts": PAGE, "src/routes.ts": routes(), "src/charts.contract.ts": CONTRACT };
const PAGE_AT = [`${LIB}/src/Page.ts`];
/** The project with the page at `src/Page/index.ts`, bound by `spec`. */
const folder = (spec: string): Tree => ({
  "src/Page/index.ts": PAGE,
  "src/routes.ts": routes(spec),
  "src/charts.contract.ts": CONTRACT,
});
const twice = (src: string): Tree => ({ ...base, "src/Twice.ts": src });

it("a page only its binding reaches takes the literal id", () => {
  expect(e1161(base)).toEqual([]);
});

it("a page bound by a directory index or a ?query is a route component, its id under the manifest id", () => {
  const dir = folder("./Page");
  expect(e1161(dir)).toEqual([]);
  expect(e1161({ ...base, "src/routes.ts": routes("./Page.ts?v=1") })).toEqual([]);
});

it("a second reach through a directory index, a ?query or a no-substitution template is one E1161", () => {
  const dir = folder("./Page/index.ts");
  expect(
    e1161({ ...dir, "src/Twice.ts": "import Page from './Page'\nexport const T = () => [Page(), Page()]\n" }),
  ).toEqual([`${LIB}/src/Page/index.ts`]);
  expect(e1161(twice("import Page from './Page.ts?x'\nexport const T = () => [Page(), Page()]\n"))).toEqual(PAGE_AT);
  expect(e1161(twice("import Page from './Page.js'\nexport const T = () => [Page(), Page()]\n"))).toEqual(PAGE_AT);
  expect(e1161(twice("export const T = async () => (await import(`./Page.ts`)).default\n"))).toEqual(PAGE_AT);
  expect(e1161(twice("export { default as P } from './Page'\n"))).toEqual(PAGE_AT);
  expect(e1161(twice("export * from './Page.ts'\n"))).toEqual(PAGE_AT);
  expect(e1161(twice("export const T = () => require('./Page.ts').default\n"))).toEqual(PAGE_AT);
});

it("the binding reaching the page twice, or binding it to two routes, is one E1161", () => {
  const two = "{ 'charts.page': { component: Page }, 'charts.other': { component: Page } }";
  expect(e1161({ ...base, "src/routes.ts": routes("./Page.ts", two) })).toEqual(PAGE_AT);
  const again = routes().replace("import Page from './Page.ts'\n", "import Page from './Page.ts'\nimport './Page'\n");
  expect(e1161({ ...base, "src/routes.ts": again })).toEqual(PAGE_AT);
});

it("a computed import(), require or import.meta.glob in the library names every file of it", () => {
  for (const src of [
    "const n = './Pa' + 'ge.ts'\nexport const T = async () => (await import(n)).default\n",
    "const n = 'Page'\nexport const T = async () => (await import(`./${n}.ts`)).default\n",
    "const g = import.meta.glob('./Pag*.ts', { eager: true })\nexport const T = () => Object.values(g)\n",
    "const n = './Page.ts'\nexport const T = () => require(n).default\n",
    "import { createRequire } from 'node:module'\nconst r = createRequire(import.meta.url)\nexport const T = () => r('./Page.ts').default\n",
  ])
    expect(e1161(twice(src)), src).toEqual(PAGE_AT);
});

it("another library's or an app file's relative path to the page is one E1161", () => {
  const b = "node_modules/@acme/b";
  const other = {
    "modules/shop/module.ts": manifest("shop", ["@acme/charts", "@acme/b"]),
    [`${b}/package.json`]: JSON.stringify({
      name: "@acme/b",
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: { ".": "./src/index.ts" },
    }),
    [`${b}/module.ts`]: manifest("b", [], ["Page"]),
    [`${b}/src/index.ts`]: "export { default as Page } from '../../charts/src/Page.ts'\n",
  };
  expect(e1161(base, other)).toEqual(PAGE_AT);
  expect(
    e1161(base, {
      "modules/shop/T.ts": "import P from '../../node_modules/@acme/charts/src/Page.ts'\nexport const T = P\n",
    }),
  ).toEqual(PAGE_AT);
});

it("an app's test reaching the page is no second render", () => {
  expect(
    e1161(base, {
      "modules/shop/T.test.ts": "import P from '../../node_modules/@acme/charts/src/Page.ts'\nexport const T = P\n",
    }),
  ).toEqual([]);
});

it("a page an exports pattern covers is an entry: one E1161", () => {
  expect(e1161(base, {}, { "./*": "./src/*" })).toEqual(PAGE_AT);
  expect(e1161(base, {}, { "./x/*": "./src/*.ts" })).toEqual(PAGE_AT);
  expect(e1161(base, {}, { "./lib/*": "./src/lib/*" })).toEqual([]);
});
