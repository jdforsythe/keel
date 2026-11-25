// Spec: k.library, clause "In that project, with `src/routes.ts` binding `component: Page` (`import Page from './Page.ts'`) in `manifest(`, `Box({ id: 'charts.page' })` in `src/Page.ts` is no E1161; `shop.page`, `charts`, `charts.` and `chartsx.page` there, and `charts.page` with no `src/routes.ts`, with `Page` in `public.exports` or with a spread after it, are each one E1161."
// Seed: 1337 (the properties over the id's rest and prefix); every other case is an example.
// ASSUMPTIONS (spec silent): "that project" is library-rules.test.ts's (`modules/shop/module.ts` lists `@acme/charts`, `node_modules/@acme/charts/` holds the library, manifest id `charts`);
// `src/routes.ts` is `manifest(charts, { 'charts.page': { component: Page } })` over a `./charts.contract.ts` the `./contract` entry names; `Page` is not in `public.exports` unless the case says so, and no `exports` entry names it;
// "a spread after it" is `Box({ id: 'charts.page', ...props })`; each case asserts the E1161 diagnostics alone.
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

describe("a route component of a library may write a literal id under the manifest id", () => {
  test("`Box({ id: 'charts.page' })` in `src/Page.ts`, bound by `src/routes.ts` as `component: Page`, is no E1161", () => {
    expect(e1161(project(page("charts.page")))).toEqual([]);
  });

  test(
    "any `charts.<rest>` with a non-empty rest is no E1161 there",
    () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-z][a-z0-9.]{0,10}$/), (rest) => {
          expect(e1161(project(page(`charts.${rest}`)))).toEqual([]);
        }),
        { seed: SEED, numRuns: 20 },
      );
    },
    CHECK_CASE_BOUND,
  );

  for (const id of ["shop.page", "charts", "charts.", "chartsx.page"]) {
    test(`\`${id}\` there is one E1161`, () => {
      expect(e1161(project(page(id))).length).toBe(1);
    });
  }

  test(
    "an id under any prefix but `charts.` is one E1161 there",
    () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-z]{3,8}$/), fc.stringMatching(/^[a-z]{1,6}$/), (prefix, rest) => {
          fc.pre(prefix !== "charts");
          expect(e1161(project(page(`${prefix}.${rest}`))).length).toBe(1);
        }),
        { seed: SEED, numRuns: 20 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test("`charts.page` with no `src/routes.ts` is one E1161", () => {
    expect(e1161(project(page("charts.page"), null)).length).toBe(1);
  });

  test("`charts.page` with `Page` in `public.exports` is one E1161", () => {
    expect(e1161(project(page("charts.page"), ROUTES, ["Badge", "Page"])).length).toBe(1);
  });

  test("`charts.page` with a spread after it, `Box({ id: 'charts.page', ...props })`, is one E1161", () => {
    const src = `${UI}export default function Page(props: Record<string, string>) {\n  return Box({ id: 'charts.page', ...props })\n}\n`;
    expect(e1161(project(src)).length).toBe(1);
  });
});
