// Spec: k.library-pages, clause "In that project, with `src/routes.ts` binding `Page`, `charts.page` in `src/Page.ts` is one E1161 when `src/index.ts` re-exports it as `Status`, when `src/Both.ts` imports it, and when `src/routes.ts` exports `Page`."
// Spec: k.library-pages, clause "In that project, `charts.page` in `src/Page.ts` is one E1161 when `src/Twice.ts` names it by `./Page.ts?x`, `./Page.js`, `` import(`./Page.ts`) ``, `export * from './Page.ts'` or `require('./Page.ts')`, when another library's file or an app module's file names it by a relative path, when an `exports` pattern `./*` targets `./src/*`, when `src/routes.ts` binds `Page` to two entries, and when `src/Twice.ts` holds `import(n)` or `import.meta.glob`; bound as `./Page` to `src/Page/index.ts`, or as `./Page.ts?v=1`, it is no E1161, as it is when an app's test file imports it."
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

// ---- the third bullet: each reach the bullet names is one E1161; a folder-index binding, a `?v=1` binding and an app test's import are none ----
// ASSUMPTIONS (spec silent): "another library's file" is `node_modules/@acme/other/src/Other.ts` (a library of id `other`, listed in `deps`) importing `../../charts/src/Page.ts`; "an app module's file"
// is `modules/shop/Reach.ts` importing `../../node_modules/@acme/charts/src/Page.ts`; "an app's test file" is `modules/shop/test/page.test.ts` importing the same path; "`exports` pattern `./*` targets `./src/*`"
// is the package.json `exports` gaining `"./*": "./src/*"`; "binds `Page` to two entries" is a second contract route `charts.other` bound to `Page` too; `import.meta.glob` is `import.meta.glob('./*.ts')`.
const PAGE_AT = (rel: string) => (files: Files) =>
  check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1161" && d.path === `${ROOT}/${rel}`);

const TWO_CONTRACT = add(
  "src/charts.contract.ts",
  "import { contract } from '@keel/router/contract'\nexport const charts = contract('charts', { 'charts.page': { path: '/charts' }, 'charts.other': { path: '/other' } })\n",
);
const packageJson = (extraExports: Record<string, unknown>) =>
  add(
    "package.json",
    JSON.stringify({
      name: "@acme/charts",
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: {
        ".": { keel: "./src/index.ts", default: "./index.js" },
        "./contract": { keel: "./src/charts.contract.ts" },
        ...extraExports,
      },
    }),
  );
const TWICE: ReadonlyArray<readonly [string, string]> = [
  ["`./Page.ts?x`", "import Page from './Page.ts?x'\nexport const used = Page\n"],
  ["`./Page.js`", "import Page from './Page.js'\nexport const used = Page\n"],
  ["`import(`./Page.ts`)`", "export const used = import(`./Page.ts`)\n"],
  ["`export * from './Page.ts'`", "export * from './Page.ts'\n"],
  [
    "`require('./Page.ts')`",
    "declare const require: (s: string) => unknown\nexport const used = require('./Page.ts')\n",
  ],
  ["`import(n)`", "export const load = (n: string) => import(n)\n"],
  ["`import.meta.glob`", "export const all = import.meta.glob('./*.ts')\n"],
];
for (const [what, src] of TWICE) {
  test(
    `\`charts.page\` in \`src/Page.ts\` is one E1161 when \`src/Twice.ts\` names it by ${what}`,
    () => {
      expect(PAGE_AT("src/Page.ts")(withFile(base(), add("src/Twice.ts", src))).length).toBe(1);
    },
    CHECK_CASE_BOUND,
  );
}

test(
  "`charts.page` in `src/Page.ts` is one E1161 when another library's file names it by a relative path",
  () => {
    const other = "node_modules/@acme/other";
    const files: Files = [
      ...withFile(base(), {
        path: "modules/shop/module.ts",
        source: manifestFile({ id: "shop", deps: ["@acme/charts", "@acme/other"] }).source,
      }),
      {
        path: `${other}/package.json`,
        source: JSON.stringify({
          name: "@acme/other",
          version: "1.0.0",
          type: "module",
          keel: "library",
          exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
        }),
      },
      { path: `${other}/index.js`, source: "export {}\n" },
      manifestFile({ id: "other", deps: [], exports: [] }, other),
      { path: `${other}/src/index.ts`, source: "export {}\n" },
      {
        path: `${other}/src/Other.ts`,
        source: "import Page from '../../charts/src/Page.ts'\nexport const used = Page\n",
      },
      { path: `${other}/.keel/ledger.json`, source: LEDGER },
    ];
    expect(PAGE_AT("src/Page.ts")(files).length).toBe(1);
  },
  CHECK_CASE_BOUND,
);

test(
  "`charts.page` in `src/Page.ts` is one E1161 when an app module's file names it by a relative path",
  () => {
    const reach = {
      path: "modules/shop/Reach.ts",
      source: `import Page from '../../${ROOT}/src/Page.ts'\nexport const used = Page\n`,
    };
    expect(PAGE_AT("src/Page.ts")([...base(), reach]).length).toBe(1);
  },
  CHECK_CASE_BOUND,
);

test(
  "`charts.page` in `src/Page.ts` is one E1161 when an `exports` pattern `./*` targets `./src/*`",
  () => {
    expect(PAGE_AT("src/Page.ts")(withFile(base(), packageJson({ "./*": "./src/*" }))).length).toBe(1);
  },
  CHECK_CASE_BOUND,
);

test(
  "`charts.page` in `src/Page.ts` is one E1161 when `src/routes.ts` binds `Page` to two entries",
  () => {
    const routes =
      "import { manifest } from '@keel/router'\nimport Page from './Page.ts'\nimport { charts } from './charts.contract.ts'\nexport const routes = manifest(charts, { 'charts.page': { component: Page }, 'charts.other': { component: Page } })\n";
    const files = withFile(withFile(base(), TWO_CONTRACT), add("src/routes.ts", routes));
    expect(PAGE_AT("src/Page.ts")(files).length).toBe(1);
  },
  CHECK_CASE_BOUND,
);

test(
  "`charts.page` in `src/Twice.ts`-reached `src/Page.ts` is one E1161 for any query after the specifier",
  () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9]{1,6}$/), (q) => {
        const src = `import Page from './Page.ts?${q}'\nexport const used = Page\n`;
        expect(PAGE_AT("src/Page.ts")(withFile(base(), add("src/Twice.ts", src))).length).toBe(1);
      }),
      { seed: SEED, numRuns: 15 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "`charts.page`, bound as `./Page` to `src/Page/index.ts`, is no E1161",
  () => {
    const routes = ROUTES.replace("'./Page.ts'", "'./Page'");
    const files = withFile(
      withFile([...base().filter((f) => f.path !== `${ROOT}/src/Page.ts`)], add("src/routes.ts", routes)),
      add("src/Page/index.ts", page("charts.page")),
    );
    expect(PAGE_AT("src/Page/index.ts")(files)).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "`charts.page`, bound as `./Page.ts?v=1`, is no E1161",
  () => {
    const files = withFile(base(), add("src/routes.ts", ROUTES.replace("'./Page.ts'", "'./Page.ts?v=1'")));
    expect(PAGE_AT("src/Page.ts")(files)).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "`charts.page` in `src/Page.ts` is no E1161 when an app's test file imports it",
  () => {
    const test_ = {
      path: "modules/shop/test/page.test.ts",
      source: `import Page from '../../../${ROOT}/src/Page.ts'\nexport const used = Page\n`,
    };
    expect(PAGE_AT("src/Page.ts")([...base(), test_])).toEqual([]);
  },
  CHECK_CASE_BOUND,
);
