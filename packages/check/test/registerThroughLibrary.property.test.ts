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

const ONE = `import { register } from '@keel/ctx'\n${IMPL}export function store(name: string) {\n  return register(name, { real: impl, shell: impl, sim: impl })\n}\n`;
const at = (source: string, needle: string): string => {
  const i = source.lastIndexOf(needle);
  const before = source.slice(0, i);
  return `${before.split("\n").length}:${i - before.lastIndexOf("\n")}`;
};

test("a const alias in the file and a project file's re-export are followed to the call, which is judged", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,6}$/), (tail) => {
      const alias = (arg: string) =>
        `import { store } from '@acme/store'\nconst db = store\nconst again = db\nexport const d = again(${arg})\n`;
      expect(e1607(project(ONE, [{ path: "modules/a/d.server.ts", source: alias(`'a.${tail}'`) }]))).toEqual([]);
      const bad = alias(`'${tail}'`);
      expect(e1607(project(ONE, [{ path: "modules/a/d.server.ts", source: bad }]))).toEqual([
        `modules/a/d.server.ts:${at(bad, `'${tail}')`)} store of "${tail}": name it 'a.<lowerCamel>'`,
      ]);
      const through = [
        { path: "modules/a/lib.ts", source: "export { store as keep } from '@acme/store'\n" },
        {
          path: "modules/a/d.server.ts",
          source: `import { keep } from './lib.ts'\nexport const d = keep('${tail}')\n`,
        },
      ];
      expect(e1607(project(ONE, through))).toHaveLength(1);
    }),
    { seed: 1337, numRuns: 15 },
  );
});

test("each use of the export as a value is one E1607 at the use: an argument, a property, .call, .apply, .bind, an exported alias, a computed namespace member", () => {
  const shapes: [string, string][] = [
    ["import { store } from '@acme/store'\nconst run = (f: unknown) => f\nexport const d = run(store)\n", "store)"],
    ["import { store } from '@acme/store'\nexport const d = { make: store }\n", "store }"],
    ["import { store } from '@acme/store'\nexport const d = { store }\n", "store }"],
    ["import { store } from '@acme/store'\nexport const d = store.call(undefined, 'a.main')\n", "store.call"],
    ["import { store } from '@acme/store'\nexport const d = store.apply(undefined, ['a.main'])\n", "store.apply"],
    ["import { store } from '@acme/store'\nexport const d = store.bind(undefined)\n", "store.bind"],
    ["import { store } from '@acme/store'\nexport const db = store\n", "store\n"],
    ["import { store } from '@acme/store'\nconst db = store\nexport { db }\n", "store\nexport {"],
    ["import { store } from '@acme/store'\nlet db = store\nexport const d = db\n", "store\nexport"],
    ["import * as lib from '@acme/store'\nconst k = 'store'\nexport const d = lib[k]\n", "lib[k]"],
    ["import * as lib from '@acme/store'\nexport const d = lib.store\n", "lib.store"],
    ["import * as lib from '@acme/store'\nconst run = (f: unknown) => f\nexport const d = run(lib)\n", "lib)"],
  ];
  for (const [source, needle] of shapes) {
    const found = e1607(project(ONE, [{ path: "modules/a/d.server.ts", source }]));
    const who = needle.startsWith("lib") && needle !== "lib.store" ? "lib" : "store";
    expect(found, source).toEqual([
      `modules/a/d.server.ts:${at(source, needle)} ${who} used as a value: the name it registers cannot be read here`,
    ]);
  }
});

test("a spread argument, a type position and a re-export are no value use; a spread is judged as no literal", () => {
  const typed = "import { store } from '@acme/store'\nexport type S = typeof store\nexport { store }\n";
  expect(e1607(project(ONE, [{ path: "modules/a/d.server.ts", source: typed }]))).toEqual([]);
  const spread =
    "import { store } from '@acme/store'\nconst args = ['a.main'] as const\nexport const d = store(...args)\n";
  expect(e1607(project(ONE, [{ path: "modules/a/d.server.ts", source: spread }]))).toEqual([
    `modules/a/d.server.ts:${at(spread, "...args")} store of a name that is not a string literal: name it 'a.<lowerCamel>'`,
  ]);
});

// The forms a name reaches a call through: each followed one judges `'a.<tail>'` clean and `'<tail>'` at the argument.
const FOLLOW: [string, Files][] = [
  [
    "import * as ns from './re1.ts'\nconst { store: s } = ns\nexport const d = s(ARG)\n",
    [
      { path: "modules/a/re1.ts", source: "export { store } from './re2.ts'\n" },
      { path: "modules/a/re2.ts", source: "export { store } from '@acme/store'\n" },
    ],
  ],
  ["export const d = (async () => (await import('@acme/store')).store(ARG))()\n", []],
  ["export const d = async () => {\n  const { store } = await import('@acme/store')\n  return store(ARG)\n}\n", []],
  [
    "import { store } from './re.ts'\nexport const d = store(ARG)\n",
    [{ path: "modules/a/re.ts", source: "export * from '@acme/store'\n" }],
  ],
  [
    "import { s3 } from './r3.ts'\nexport const d = s3(ARG)\n",
    [
      { path: "modules/a/r1.ts", source: "export { store as s1 } from '@acme/store'\n" },
      { path: "modules/a/r2.ts", source: "export { s1 as s2 } from './r1.ts'\n" },
      { path: "modules/a/r3.ts", source: "export { s2 as s3 } from './r2.ts'\n" },
    ],
  ],
  ["import lib = require('@acme/store')\nexport const d = lib.store(ARG)\n", []],
];

test("each followed form judges the name at the call (property over the name)", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,6}$/), fc.constantFrom(...FOLLOW), (tail, [src, extra]) => {
      const file = (arg: string) => [...extra, { path: "modules/a/d.server.ts", source: src.replace("ARG", arg) }];
      expect(e1607(project(ONE, file(`'a.${tail}'`))), src).toEqual([]);
      const bad = src.replace("ARG", `'${tail}'`);
      // The message names the export by the local an import binds, or by its key when read off a namespace.
      const by = src.includes("s3(") ? "s3" : "store";
      expect(e1607(project(ONE, file(`'${tail}'`))), src).toEqual([
        `modules/a/d.server.ts:${at(bad, `'${tail}'`)} ${by} of "${tail}": name it 'a.<lowerCamel>'`,
      ]);
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("each other use is one E1607 at the use: dynamic imports, namespace rest, computed and enum keys, a class static, Object.assign", () => {
  const shapes: [string, string, string][] = [
    ["export const p = import('@acme/store')\n", "import(", "import()"],
    ["export const p = import('@acme/store').then((m) => m.store('a.main'))\n", "import(", "import()"],
    ["const spec = '@acme/store'\nexport const p = import(spec)\n", "import(spec", "import()"],
    ["import * as ns from '@acme/store'\nconst { ...all } = ns\nexport const p = all\n", "...all", "ns"],
    ["import * as ns from '@acme/store'\nenum K { S = 'store' }\nexport const p = ns[K.S]\n", "ns[", "ns"],
    ["import * as ns from '@acme/store'\nexport const p = Object.assign({}, ns)\n", "ns)", "ns"],
    ["import { store } from '@acme/store'\nexport class C {\n  static f = store\n}\n", "store\n}", "store"],
    [
      "import * as ns from '@acme/store'\ndeclare const other: () => void\nconst { store: s = other } = ns\nexport const p = s\n",
      "store: s",
      "store",
    ],
  ];
  for (const [source, needle, who] of shapes) {
    expect(e1607(project(ONE, [{ path: "modules/a/d.server.ts", source }])), source).toEqual([
      `modules/a/d.server.ts:${at(source, needle)} ${who} used as a value: the name it registers cannot be read here`,
    ]);
  }
});

test("a library exporting an object holding its registering function is one E1607 at that use, in the library file", () => {
  const store = `${ONE}export default { store }\n`;
  const found = e1607(project(store, []));
  expect(found).toEqual([
    `node_modules/@acme/store/src/store.ts:${at(store, "store }")} store used as a value: the name it registers cannot be read here`,
  ]);
});
