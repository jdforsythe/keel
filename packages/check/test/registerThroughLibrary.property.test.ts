// Seed 1337. k.server-deps Registration through a library: a library's `register(name, ...)` whose name is a parameter
// of the exported function holding it is judged at each app call of that export (E1607), and nowhere else.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = { path: string; source: string }[];
const ROOT = "node_modules/@acme/store";
const manifest = (id: string, deps: string[], exports: string[] = [], root = `modules/${id}`) => ({
  path: `${root}/module.ts`,
  source: `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ${JSON.stringify(exports)} } })\n`,
});
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const IMPL = "const impl = () => ({})\n";
const PARAM2 = `import { register } from '@keel/ctx'\n${IMPL}export function store(label: string, name = 'x') {\n  return register(name, { real: impl, shell: impl, sim: impl })\n}\n`;

function project(store: string, app: Files): Files {
  return [
    manifest("a", ["@acme/store"]),
    manifest("b", ["@acme/store"]),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: "@acme/store",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
      }),
    },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    manifest("store", [], ["store"], ROOT),
    { path: `${ROOT}/src/index.ts`, source: "export * from './store.ts'\n" },
    { path: `${ROOT}/src/store.ts`, source: store },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    ...app,
  ];
}
const e1607 = (files: Files) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1607")
    .map((d) => `${d.path}:${d.line}:${d.col} ${d.message}`);

test("the argument for the parameter's index is judged, through `export *`, by name or off a namespace import", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,6}$/), fc.boolean(), (tail, spaced) => {
      const call = (arg: string): string =>
        spaced
          ? `import * as lib from '@acme/store'\nexport const d = lib.store('label', ${arg})\n`
          : `import { store } from '@acme/store'\nexport const d = store('label', ${arg})\n`;
      const at = (arg: string): string => `${call(arg).split("\n")[1]?.indexOf(arg) ?? 0}`;
      expect(e1607(project(PARAM2, [{ path: "modules/a/d.server.ts", source: call(`'a.${tail}'`) }]))).toEqual([]);
      const bad = e1607(project(PARAM2, [{ path: "modules/a/d.server.ts", source: call(`'b.${tail}'`) }]));
      expect(bad).toEqual([
        `modules/a/d.server.ts:2:${Number(at(`'b.${tail}'`)) + 1} store of "b.${tail}": name it 'a.<lowerCamel>'`,
      ]);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test("an app call with no argument for the parameter is one E1607 at the call", () => {
  const source = "import { store } from '@acme/store'\nexport const d = store('label')\n";
  expect(e1607(project(PARAM2, [{ path: "modules/a/d.server.ts", source }]))).toEqual([
    "modules/a/d.server.ts:2:18 store of a name that is not a string literal: name it 'a.<lowerCamel>'",
  ]);
});

test("one name given by two app calls in two files is one E1607, at the call in the file whose path sorts later", () => {
  const call = "import { store } from '@acme/store'\nexport const d = store('l', 'a.main')\n";
  const found = e1607(
    project(PARAM2, [
      { path: "modules/a/d.server.ts", source: call },
      { path: "modules/a/e.server.ts", source: call },
    ]),
  );
  expect(found).toEqual(['modules/a/e.server.ts:2:29 capability "a.main" also registered at modules/a/d.server.ts:2']);
});

test("a library register whose name is a parameter of a function its file does not export is E1607 in the library file", () => {
  const store = `import { register } from '@keel/ctx'\n${IMPL}const inner = (name: string) => register(name, { real: impl, shell: impl, sim: impl })\nexport function store() {\n  return inner('store.main')\n}\n`;
  const found = e1607(project(store, []));
  expect(found).toHaveLength(1);
  expect(found[0]).toMatch(/^node_modules\/@acme\/store\/src\/store\.ts:3:/);
});
