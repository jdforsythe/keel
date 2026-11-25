// k.library the three clauses on `deps` naming a package, each quoted whole
// Spec: k.library, clause "In that project, `deps: ['@acme/none']`, naming no installed package, is one E1159 at the entry; so is `'@acme/plain'`, installed with a `package.json` that has no `keel` field."
// Spec: k.library, clause "In that project, with `node_modules/@acme/charts/tools.js` registering a rule that reports `E2999` on every app file and `exports` gaining `\"./tools\": \"./tools.js\"`, `keel check` reports `E2999`; with `modules/shop/module.ts` listing no `'@acme/charts'`, it does not."
// Spec: k.library, clause "In that project, with `exports` gaining `\"./routes\": \"./routes.js\"`, whose `routes` table holds route `charts.about` at `/about`, the `routes.json` `keel build` writes for a deployable whose `topology.ts` `modules` is `['shop']` holds no `charts.about`, and for one whose `modules` is `['shop', 'charts']` it holds it."
// "That project" is the first Conformance clause of k.library (library-support.ts builds it in a temporary project; `keel` runs as the real binary).
// Rules: E1159 "A package `deps` entry that resolves to no package with `\"keel\": \"library\"` is E1159 (k.module)."
// In an app: "A `deps` entry that begins with `@` names a package; any other entry is a module id of the project."
// Seed 1337
// ASSUMPTIONS (spec silent): in clause 10 `deps` is the app's `modules/shop/module.ts` list, gaining the entry beside `'@acme/charts'`; "at the entry" is a position on the entry's line
// from its opening quote to its closing one. Clause 12 builds the project without `modules/shop/Page.tsx` (the compile of a library's files is a later slice's clause, k.library 1 to 7);
// `routes.json` is `dist/api/routes.json` of the deployable `api`. No std package is imported: the libraries are written by the test.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  NAME,
  ROUTES_JS,
  SEED,
  SLOW,
  type Rec,
  type Tree,
  built,
  cleanup,
  diags,
  keel,
  library,
  materialize,
  project,
  toolsRule,
} from "./library-support.ts";

const scoped = fc
  .tuple(fc.stringMatching(/^[a-z]{4,8}$/), fc.stringMatching(/^[a-z]{4,8}$/))
  .map(([a, b]) => `@${a}/${b}`);

/** The records of `code` from `keel check` over `tree`, the temporary project removed after. */
function checkOf(tree: Tree, code: string): Rec[] {
  const dir = materialize(tree);
  try {
    return diags(keel(dir, ["check"]), code);
  } finally {
    cleanup(dir);
  }
}

/** Whether `r` lies on the `'entry'` of the file `tree` holds at `r.path`, from its opening quote to its closing one. */
function atEntry(tree: Tree, r: Rec, entry: string): boolean {
  const src = typeof r.path === "string" ? (tree[r.path] ?? "") : "";
  const idx = src.indexOf(`'${entry}'`);
  if (idx < 0 || typeof r.line !== "number" || typeof r.col !== "number") return false;
  const before = src.slice(0, idx);
  const quoteCol = idx - before.lastIndexOf("\n");
  return r.line === before.split("\n").length && r.col >= quoteCol && r.col <= quoteCol + entry.length + 1;
}

test("In that project, `deps: ['@acme/none']`, naming no installed package, is one E1159 at the entry", () => {
  fc.assert(
    fc.property(
      scoped.filter((n) => n !== NAME),
      (none) => {
        const tree = project({ deps: [NAME, none] });
        const hits = checkOf(tree, "E1159");
        expect(hits.length).toBe(1);
        expect(hits[0]?.path).toBe("modules/shop/module.ts");
        expect(atEntry(tree, hits[0] ?? { kind: "diag" }, none)).toBe(true);
      },
    ),
    { seed: SEED, numRuns: 3 },
  );
});

test("In that project, `'@acme/plain'`, installed with a `package.json` that has no `keel` field, is one E1159 at the entry", () => {
  const tree = project({
    deps: [NAME, "@acme/plain"],
    libraries: [library(), library({ name: "@acme/plain", id: "plain", keel: null })],
  });
  const hits = checkOf(tree, "E1159");
  expect(hits.length).toBe(1);
  expect(hits[0]?.path).toBe("modules/shop/module.ts");
  expect(atEntry(tree, hits[0] ?? { kind: "diag" }, "@acme/plain")).toBe(true);
});

test("E1159: an installed package whose `keel` field is `library` is no E1159 at its entry", () => {
  expect(checkOf(project(), "E1159")).toEqual([]);
});

test("A `deps` entry that does not begin with `@` is a module id of the project, never a package: it is no E1159, whether or not a package of that name is installed", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{4,8}$/), (id) => {
      const tree = project({ deps: [NAME, id], libraries: [library(), library({ name: id, id, keel: null })] });
      expect(checkOf(tree, "E1159")).toEqual([]);
    }),
    { seed: SEED, numRuns: 3 },
  );
});

const withTools = (deps: string[], extra: Tree[] = []): Tree =>
  project({
    deps,
    libraries: [library({ exports: { "./tools": "./tools.js" }, files: { "tools.js": toolsRule("E2999") } }), ...extra],
  });

test(
  'In that project, with `node_modules/@acme/charts/tools.js` registering a rule that reports `E2999` on every app file and `exports` gaining `"./tools": "./tools.js"`, `keel check` reports `E2999`',
  () => {
    const hits = checkOf(withTools([NAME]), "E2999");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((r) => r.path === "modules/shop/module.ts")).toBe(true);
  },
  SLOW,
);

test(
  "With `modules/shop/module.ts` listing no `'@acme/charts'`, `keel check` does not report the library's `E2999`",
  () => {
    expect(checkOf(withTools([]), "E2999")).toEqual([]);
  },
  SLOW,
);

test(
  "A library the listed library lists in its own manifest is found as well: its `./tools` rule reports `E2999`",
  () => {
    const tree = project({
      libraries: [
        library({ deps: ["@acme/other"] }),
        library({
          name: "@acme/other",
          id: "other",
          exports: { "./tools": "./tools.js" },
          files: { "tools.js": toolsRule("E2999") },
        }),
      ],
    });
    expect(checkOf(tree, "E2999").length).toBeGreaterThan(0);
  },
  SLOW,
);

/** The text of `dist/api/routes.json` after `keel build` over a project whose deployable `api` serves `modules`, the library exporting `./routes`. */
function routesJson(modules: string[]): string {
  const dir = materialize(
    project({
      modules,
      page: false,
      libraries: [library({ exports: { "./routes": "./routes.js" }, files: { "routes.js": ROUTES_JS } })],
    }),
  );
  try {
    const r = built(dir);
    expect(r.status, r.out).toBe(0);
    return readFileSync(join(dir, "dist/api/routes.json"), "utf8");
  } finally {
    cleanup(dir);
  }
}

test(
  'In that project, with `exports` gaining `"./routes": "./routes.js"`, the `routes.json` `keel build` writes for a deployable whose `modules` is `[\'shop\']` holds no `charts.about`',
  () => {
    const text = routesJson(["shop"]);
    expect(text).toContain("shop.home");
    expect(text).not.toContain("charts.about");
  },
  SLOW,
);

test(
  "In that project, the `routes.json` `keel build` writes for a deployable whose `topology.ts` `modules` is `['shop', 'charts']` holds `charts.about`",
  () => {
    const text = routesJson(["shop", "charts"]);
    expect(text).toContain("shop.home");
    expect(text).toContain("charts.about");
  },
  SLOW,
);
