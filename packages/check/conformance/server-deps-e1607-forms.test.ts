// Spec: k.server-deps, Registration through a library, second paragraph, quoted whole:
// "In a library file, a `register` call whose name is a parameter of the exported function holding it (the innermost enclosing function with a parameter, plain or defaulted, of that name) is no E1607 (k.data). Each call of that export, by its imported name or off a namespace import of the library, is judged instead by its argument for that parameter, as k.data judges a `register` name in the calling file: not a string literal `<id>.<name>`, `<id>` the calling file's module and `<name>` one lowerCamel segment, is one E1607 at the argument, and at the call when it has none (message `<export> of "<name>": name it '<id>.<lowerCamel>'`, or `<export> of a name that is not a string literal: ...`; `<id>` is the calling module's id, clipped to 20 units, and `<lowerCamel>` stays as written; `<export>` is the local an import binds, or the key read off a namespace, clipped to 20); a name two such calls, or a call and a `register`, give in two files is one E1607 at the later file's, as for two `register` calls. A library `register` whose name is any other non-literal, such as a local or a parameter of a function its file does not export, is E1607 in the library file. The read follows the export as the function read does, through at most 8 files (k.privacy-reads' read depth): imported by name or as the default, from the library or through project files that re-export it (`export { x }`, renamed, `export *`, `export default x`); its declaration in its own file; a `const` alias; a static member of a namespace (`import * as ns`, `import ns = require('<spec>')`, or a directly awaited `(await import('<spec>'))` with `<spec>` a literal); and a `const` destructuring of such a namespace by plain keys (`const { store: s } = ns`). Each is judged at its call. Any other use is one E1607 at the use, message `<export> used as a value: the name it registers cannot be read here`, `<export>` the namespace's local name when the use is the namespace itself and `import()` for a dynamic import: passed as an argument, held in an array, object or class field, a member of it (`.call`, `.apply`, `.bind`), a `let` or exported alias, a rest, defaulted or computed key in a destructuring, a computed member of the namespace (an `enum` key among them), the namespace as a value (`Object.assign({}, ns)`), and an `import()` of a module whose exports hold one other than as above (stored, passed, `.then`) or with a non-literal specifier. A name in a type position (`typeof x`) is no use; a spread argument is no string literal. Code held in a string (`eval`, `new Function`) is out of scope: check reads no code a string holds."
// Seed 1337 (every property). In process: `check()` over source text. The library is the made-up `@acme/store`: `src/index.ts` re-exports `store` from `./store.ts`, which calls `register(name, ...)` with `name` the parameter of `store`. Module `a` lists it; the call sits in `modules/a/data.server.ts`.
// ASSUMPTIONS (spec silent): the read depth counts the files a chain passes, the calling file, the library's `src/index.ts` and the defining `src/store.ts` among them, so a chain of N project re-export files is 8 files at N = 5 (the bound) and 9 at N = 6, the calling file counting as the first; a chain past the bound is not followed, and the text does not say what it yields:
// the case asserts the safe reading, one E1607 at the use (the import of the name that cannot be read), and names the sentence for the spec to make exact. A position is 1-based; "at the use" is the line of that span; a `const ns = await import(...)` held and read on a later line is asserted by the contract "followed to a judged name or one E1607 at the use" only.
// Shapes the spec does not list (round 4, an attacker's): the awaited `import()` inside a helper, a held awaited import destructured later, a namespace re-exported and destructured in a third file, a chain mixing `export *` and a renamed export, `store?.(x)`, a tagged template, `new store(x)`, a decorator. Each must be followed to a judged name or be an E1607 at the use; a shape that passes clean is a HOLE.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, manifestFile } from "./module-support.ts";

const NAME = "@acme/store";
const ROOT = `node_modules/${NAME}`;
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const IMPL = "const impl = () => ({ title: () => 'lib' })\n";
const STORE_PARAM = `import { register } from '@keel/ctx'\n${IMPL}export function store(name: string) {\n  return register(name, { real: impl, shell: impl, sim: impl })\n}\n`;
const DATA = "modules/a/data.server.ts";

function project(
  data: string,
  extra: Files = [],
  index = "export { store } from './store.ts'\n",
  store = STORE_PARAM,
): Files {
  return [
    manifestFile({ id: "a", deps: [NAME] }),
    { path: DATA, source: data },
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: NAME,
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
      }),
    },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    manifestFile({ id: "store", deps: [], capabilities: ["store.main"], exports: ["store"] }, ROOT),
    { path: `${ROOT}/src/index.ts`, source: index },
    { path: `${ROOT}/src/store.ts`, source: store },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    ...extra,
  ];
}
const e1607 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1607");
const IMPORT = `import { store } from '${NAME}'\n`;
const NS = `import * as lib from '${NAME}'\n`;
const re = (path: string, source: string): Files => [{ path: `modules/a/${path}`, source }];
const GOOD = "'a.main'";
const BAD = "'main'";

/** `src` with its one `¤` marker removed, and where the marker stood. */
function marked(src: string): { source: string; line: number; col: number } {
  const idx = src.indexOf("¤");
  const source = src.replace("¤", "");
  const before = source.slice(0, idx);
  return { source, line: before.split("\n").length, col: idx - before.lastIndexOf("\n") };
}

// ---- the followed forms: a good name is no E1607, a bad one is one at the argument ----
type Form = [string, Files, string, string?];
const chainOf = (n: number): Files => [
  ...Array.from({ length: n }, (_, i) => ({
    path: `modules/a/c${i + 1}.ts`,
    source: i + 1 === n ? `export { store } from '${NAME}'\n` : `export { store } from './c${i + 2}.ts'\n`,
  })),
];
const FORMS: Form[] = [
  [
    "a re-export chain of 5 project files (8 files with the calling file and the library's two, the bound)",
    chainOf(5),
    "import { store } from './c1.ts'\nexport const r = store(¤ARG)\n",
  ],
  [
    "`export *` from the library in a project file",
    re("re.ts", `export * from '${NAME}'\n`),
    "import { store } from './re.ts'\nexport const r = store(¤ARG)\n",
  ],
  [
    "`export *` through two project files",
    [...re("re1.ts", "export * from './re2.ts'\n"), ...re("re2.ts", `export * from '${NAME}'\n`)],
    "import { store } from './re1.ts'\nexport const r = store(¤ARG)\n",
  ],
  [
    "a renamed re-export three files deep",
    [
      ...re("re1.ts", "export { y as z } from './re2.ts'\n"),
      ...re("re2.ts", "export { x as y } from './re3.ts'\n"),
      ...re("re3.ts", `export { store as x } from '${NAME}'\n`),
    ],
    "import { z } from './re1.ts'\nexport const r = z(¤ARG)\n",
  ],
  [
    "a chain mixing `export *` and a renamed export",
    [...re("re1.ts", "export * from './re2.ts'\n"), ...re("re2.ts", `export { store as renamed } from '${NAME}'\n`)],
    "import { renamed } from './re1.ts'\nexport const r = renamed(¤ARG)\n",
  ],
  ["a `const` alias", [], `${IMPORT}const db = store\nexport const r = db(¤ARG)\n`],
  ["a static member of a namespace import", [], `${NS}export const r = lib.store(¤ARG)\n`],
  [
    "a static member of `import ns = require('<spec>')`",
    [],
    `import lib = require('${NAME}')\nexport const r = lib.store(¤ARG)\n`,
  ],
  [
    "a static member of a directly awaited literal `import()`",
    [],
    `export const r = (async () => (await import('${NAME}')).store(¤ARG))()\n`,
  ],
  [
    "a `const` destructuring of a directly awaited literal `import()`",
    [],
    `export const r = (async () => {\n  const { store: s } = await import('${NAME}')\n  return s(¤ARG)\n})()\n`,
  ],
  [
    "a `const` destructuring of a namespace by plain keys",
    [],
    `${NS}const { store: s } = lib\nexport const r = s(¤ARG)\n`,
  ],
  [
    "a `const` destructuring by a plain key, unrenamed",
    [],
    `${NS}const { store } = lib\nexport const r = store(¤ARG)\n`,
  ],
  [
    "a `const` destructuring of a namespace imported from a re-export chain two files deep",
    [...re("re1.ts", "export * from './re2.ts'\n"), ...re("re2.ts", `export * from '${NAME}'\n`)],
    "import * as ns from './re1.ts'\nconst { store: s } = ns\nexport const r = s(¤ARG)\n",
  ],
];

for (const [what, extra, src] of FORMS) {
  test(`${what} is followed to its call: \`'a.main'\` is no E1607 and \`'main'\` one at the argument`, () => {
    expect(e1607(project(marked(src).source.replace("ARG", GOOD), extra))).toEqual([]);
    const at = marked(src.replace("ARG", BAD));
    const found = e1607(project(at.source, extra));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe(DATA);
    expect(found[0]?.line).toBe(at.line);
    expect(found[0]?.col).toBeGreaterThanOrEqual(at.col);
    expect(found[0]?.col).toBeLessThanOrEqual(at.col + BAD.length);
  });
}

test("the read depth: a re-export chain of 5 project files (8 files, the calling file and the library's two among them) is followed, one of 6 (9 files) is not and is one E1607 at the use, HOLE if it passes clean (property over the good and bad names)", () => {
  const camel = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/);
  fc.assert(
    fc.property(camel, (tail) => {
      const src = (arg: string): string => `import { store } from './c1.ts'\nexport const r = store(${arg})\n`;
      for (const n of [1, 5]) {
        expect(e1607(project(src(`'a.${tail}'`), chainOf(n))), `${n} files`).toEqual([]);
        const bad = e1607(project(src(`'${tail}'`), chainOf(n)));
        expect(bad, `${n} files`).toHaveLength(1);
        expect(bad[0]?.line).toBe(2);
      }
      for (const arg of [`'a.${tail}'`, `'${tail}'`]) {
        const past = e1607(project(src(arg), chainOf(6)));
        expect(past, "9 files").toHaveLength(1);
        expect(past[0]?.path).toBe(DATA);
        expect(past[0]?.line).toBe(2);
      }
    }),
    { seed: SEED, numRuns: 12 },
  );
});

// ---- the uses that are E1607, message whole ----
const MSG = (e: string): string => `${e} used as a value: the name it registers cannot be read here`;
type Use = [string, Files, string, string, string?];
// [name, extra files, data source with `¤` at the use, `<export>` as the message gives it, library index]
const USES: Use[] = [
  ["a stored `import()`", [], `export const p = ¤import('${NAME}')\n`, "import()"],
  ["a passed `import()`", [], `declare function run(p: unknown): void\nrun(¤import('${NAME}'))\n`, "import()"],
  [
    "an `import()` followed by `.then`",
    [],
    `export const r = ¤import('${NAME}').then((m) => m.store('a.main'))\n`,
    "import()",
  ],
  [
    "an `import()` with a non-literal specifier",
    [],
    `${IMPORT}declare const spec: string\nexport const r = (async () => (await ¤import(spec)).x)()\n`,
    "import()",
  ],
  [
    "a rest element in a destructuring of the namespace",
    [],
    `${NS}const { ...rest } = ¤lib\nexport const r = rest\n`,
    "lib",
  ],
  [
    "an `enum`-keyed access of the namespace",
    [],
    `${NS}enum K {\n  s = 'store',\n}\nexport const r = ¤lib[K.s]('a.main')\n`,
    "lib",
  ],
  ["`Object.assign({}, ns)`", [], `${NS}export const r = Object.assign({}, ¤lib)\n`, "lib"],
  ["a class static assigned from the export", [], `${IMPORT}export class C {\n  static f = ¤store\n}\n`, "store"],
  [
    "a defaulted key in a destructuring of the namespace",
    [],
    `${NS}declare const other: unknown\nconst { ¤store = other } = lib\nexport const r = store\n`,
    "store",
  ],
  [
    "a computed key in a destructuring of the namespace",
    [],
    `${NS}const k = 'store'\nconst { [k]: s } = ¤lib\nexport const r = s\n`,
    "lib",
  ],
  [
    "a local name of an import under another name, passed as an argument",
    [],
    `import { store as db } from '${NAME}'\ndeclare function run(f: unknown): void\nrun(¤db)\n`,
    "db",
  ],
];
for (const [what, extra, src, exp, index] of USES) {
  test(`${what} is one E1607 at the use, message \`${MSG(exp)}\``, () => {
    const at = marked(src);
    const found = e1607(project(at.source, extra, index));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe(DATA);
    expect(found[0]?.line).toBe(at.line);
    expect(found[0]?.message).toBe(MSG(exp));
  });
}

test("a library `export default { store }` holds the export in an object: one E1607 at the use, `store used as a value: the name it registers cannot be read here`", () => {
  const index = "import { store } from './store.ts'\nexport { store }\nexport default { store }\n";
  const found = e1607(project(`${IMPORT}export const r = store('a.main')\n`, [], index));
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe(`${ROOT}/src/index.ts`);
  expect(found[0]?.line).toBe(3);
  expect(found[0]?.message).toBe(MSG("store"));
});

// ---- round 4: an attacker's shapes; each followed to a judged name or one E1607 at the use ----
const ATTACKS: [string, Files, string][] = [
  [
    "the awaited `import()` inside a helper that returns the member",
    [],
    `const load = async () => (await import('${NAME}')).store\nexport const r = load().then((f) => f('main'))\n`,
  ],
  [
    "`await import(...)` assigned to a `const`, then destructured on a later line",
    [],
    `const ns = await import('${NAME}')\nconst { store } = ns\nexport const r = store('main')\n`,
  ],
  [
    "a namespace re-exported and destructured in a third file",
    re("re.ts", `import * as ns from '${NAME}'\nexport { ns }\n`),
    "import { ns } from './re.ts'\nconst { store } = ns\nexport const r = store('main')\n",
  ],
  [
    "HOLE: a namespace re-exported with `export * as ns` and destructured in a third file",
    re("re.ts", `export * as ns from '${NAME}'\n`),
    "import { ns } from './re.ts'\nconst { store } = ns\nexport const r = store('main')\n",
  ],
  [
    "a chain mixing `export *` and a renamed export",
    [...re("re1.ts", "export * from './re2.ts'\n"), ...re("re2.ts", `export { store as renamed } from '${NAME}'\n`)],
    "import { renamed } from './re1.ts'\nexport const r = renamed('main')\n",
  ],
  ["`store?.('main')`", [], `${IMPORT}export const r = store?.('main')\n`],
  ["a tagged template", [], `${IMPORT}export const r = store\`main\`\n`],
  ["`new store('main')`", [], `${IMPORT}export const r = new store('main')\n`],
  ["a decorator `@store('main')`", [], `${IMPORT}@store('main')\nexport class C {}\n`],
  ["a bare decorator `@store`", [], `${IMPORT}@store\nexport class C {}\n`],
  ["a decorator through a namespace member, `@lib.store('main')`", [], `${NS}@lib.store('main')\nexport class C {}\n`],
  [
    "an awaited `import()` held in a `let`, then read",
    [],
    `let ns = await import('${NAME}')\nexport const r = ns.store('main')\n`,
  ],
  [
    "a destructured awaited `import()` whose key is renamed twice",
    [],
    `const { store: a } = await import('${NAME}')\nconst b = a\nexport const r = b('main')\n`,
  ],
];
for (const [what, extra, src] of ATTACKS) {
  test(`${what} is followed to a judged name or one E1607 at the use (a clean run is a HOLE)`, () => {
    const found = e1607(project(src, extra));
    expect(found.length, "HOLE: no E1607, the shape passes clean").toBeGreaterThanOrEqual(1);
    expect(found.length, "one E1607 at the use, not several").toBe(1);
  });
}
