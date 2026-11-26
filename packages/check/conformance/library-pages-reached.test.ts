// Spec: k.library-pages, clause "In that project, with `src/routes.ts` binding `Page`, `charts.page` in `src/Page.ts` is one E1161 when `src/index.ts` re-exports it as `Status`, when `src/Both.ts` imports it, and when `src/routes.ts` exports `Page`."
// Seed: 1337 (the property over the other file's name); every other case is an example.
// ASSUMPTIONS (spec silent): "that project" is library-route-ids.test.ts's; "re-exports it as `Status`" is `export { default as Status } from './Page.ts'` in `src/index.ts`;
// "imports it" is `import Page from './Page.ts'` used in `src/Both.ts`; "`src/routes.ts` exports `Page`" is `export { Page }` added to the binding file; each case asserts the E1161 diagnostics alone.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { type Files, SEED, manifestFile } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
const ROOT = "node_modules/@acme/charts";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const UI = "import { Box } from '@keel/ui'\n";
const page = (id: string): string => `${UI}export default function Page() {\n  return Box({ id: '${id}' })\n}\n`;
const ROUTES =
  "import { manifest } from '@keel/router'\nimport Page from './Page.ts'\nimport { charts } from './charts.contract.ts'\nexport const routes = manifest(charts, { 'charts.page': { component: Page } })\n";

/** The project: `src/Page.ts` holds `source`; `routes` is `src/routes.ts` (none when null); `publicExports` the manifest's. */
function project(source: string, routes: string | null = ROUTES, publicExports: string[] = ["Badge"]): Files {
  const files: Files = [
    manifestFile({ id: "shop", deps: ["@acme/charts"] }),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: "@acme/charts",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: {
          ".": { keel: "./src/index.ts", default: "./index.js" },
          "./contract": { keel: "./src/charts.contract.ts" },
        },
      }),
    },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    manifestFile({ id: "charts", deps: [], exports: publicExports }, ROOT),
    { path: `${ROOT}/src/index.ts`, source: "export {}\n" },
    {
      path: `${ROOT}/src/charts.contract.ts`,
      source:
        "import { contract } from '@keel/router/contract'\nexport const charts = contract('charts', { 'charts.page': { path: '/charts' } })\n",
    },
    { path: `${ROOT}/src/Page.ts`, source },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  ];
  return routes === null ? files : [...files, { path: `${ROOT}/src/routes.ts`, source: routes }];
}
const e1161 = (files: Files) =>
  check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1161" && d.path === `${ROOT}/src/Page.ts`);

const add = (rel: string, source: string) => ({ path: `${ROOT}/${rel}`, source });
const withFile = (files: Files, extra: { path: string; source: string }): Files => [
  ...files.filter((f) => f.path !== extra.path),
  extra,
];
const base = (): Files => project(page("charts.page"));

describe("a route component of a library that another file reaches is judged as any library file", () => {
  test("`charts.page` in `src/Page.ts`, bound by `src/routes.ts` as `Page` and reached by no other file, is no E1161", () => {
    expect(e1161(base())).toEqual([]);
  });

  test("`charts.page` in `src/Page.ts` is one E1161 when `src/index.ts` re-exports it as `Status`", () => {
    const files = withFile(base(), add("src/index.ts", "export { default as Status } from './Page.ts'\n"));
    expect(e1161(files).length).toBe(1);
  });

  test("`charts.page` in `src/Page.ts` is one E1161 when `src/Both.ts` imports it", () => {
    const both = "import Page from './Page.ts'\nexport const both = Page\n";
    expect(e1161(withFile(base(), add("src/Both.ts", both))).length).toBe(1);
  });

  test("`charts.page` in `src/Page.ts` is one E1161 when `src/routes.ts` exports `Page`", () => {
    expect(e1161(withFile(base(), add("src/routes.ts", `${ROUTES}export { Page }\n`))).length).toBe(1);
  });

  test(
    "`charts.page` in `src/Page.ts` is one E1161 when any other file of the library imports it",
    () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[A-Z][a-z]{3,8}$/), (name) => {
          const src = `import Page from './Page.ts'\nexport const used = Page\n`;
          expect(e1161(withFile(base(), add(`src/${name}.ts`, src))).length).toBe(1);
        }),
        { seed: SEED, numRuns: 20 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
