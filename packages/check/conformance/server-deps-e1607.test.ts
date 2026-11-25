// Spec: k.server-deps, Conformance clauses 5, 8 and 10, each quoted whole:
// 5. "In that project, with `store(name)` calling `register(name, ...)`, `store('a.main')` in `modules/a/data.server.ts` is no E1607 and `store('main')` there is one E1607 at the argument; the library file reports none."
// 8. "In the fifth bullet's project, `store()` with no argument in `modules/a/data.server.ts` is one E1607 at the call; `store('a.main')` in both `modules/a/data.server.ts` and `modules/a/other.server.ts` is one E1607, in `other.server.ts`; `register(name, ...)` in the library with `name` a `const` of `store.ts` is one E1607 in the library file."
// 10. "In the fifth bullet's project, `const db = store` then `db('a.main')` is no E1607 and `db('main')` one at the argument; `run(store)`, `{ make: store }`, `store.call(undefined, 'a.main')`, `store.bind(undefined)` and `export const db = store` are each one E1607 at the use."
// Registration through a library: "A file registers a capability (k.data Dev) when it imports `@keel/ctx` and names `register`, or when it imports or re-exports from a library (k.library) a name whose defining file in that library, followed through its re-exports, imports `@keel/ctx` and names `register` (a namespace import: any such name). Editing either kind of file under `keel dev` loads the server graph again whole, as k.data Dev states, before the file has registered too: after an edit that adds such an import to a file that held none, module state other server files hold starts again at the next request."
// Registration through a library, second paragraph, quoted whole: "In a library file, a `register` call whose name is a parameter of the exported function holding it (the innermost enclosing function with a parameter, plain or defaulted, of that name) is no E1607 (k.data); the name is judged where that export is called. Check traces every binding that may hold such an export: an import of it under any name; a namespace of a module that holds one (`import * as`, `import x = require`, an imported `export * as`); its declaration; a `const` alias or plain-keyed `const` destructuring of any of these; and a directly awaited literal `import()` of such a module. It crosses files through re-exports of any form and reads at most 8 files, the calling and the defining file counted. Every occurrence of such a binding is exactly one of three things: - a further binding the trace continues through: a `const` declaration (not an exported one), a plain destructuring key, `export { x }`, `export default x`, a static member of a namespace; - a call, whose argument for the parameter is judged as k.data judges a `register` name in the calling file: not a string literal `<id>.<name>`, `<id>` the calling module's id and `<name>` one lowerCamel segment, is one E1607 at the argument, and at the call when it has none (message `<export> of "<name>": name it '<id>.<lowerCamel>'`, or `<export> of a name that is not a string literal: ...`; a spread is no string literal); a name two such calls, or a call and a `register`, give in two files is one E1607 at the later file's; - one E1607 at the occurrence, message `<export> used as a value: the name it registers cannot be read here`: any other position (an optional call, `new`, `.call`, a computed, defaulted or rest key among them). A binding reached through more than 8 files is this at each occurrence, message `<export> comes through more than 8 files: the name it registers cannot be read here`."
// Registration through a library, third paragraph, quoted whole: "A name in a type position (`typeof x`, an annotation) carries no value and is no occurrence; a parameter of the same name hides the binding in its function. An `import(x)` with a computed specifier is an occurrence when a file it can reach holds such an export: for a relative template, the project files under its folder with its ending; for any other, always. `<export>` is an import's local, an alias's original, a member's or destructured key, a namespace's local, or `import()`. Any other non-literal library `register` name is E1607 in the library file. Code held in a string (`eval`, `new Function`) is out of scope."
// k.data Rules: "E1607, at `keel check`: a call of `@keel/ctx`'s `register` in a file under `modules/<id>/` whose name is not a string literal `<id>.<name>`, `<name>` one lowerCamel segment; or a name another app file registers too, reported at the call in the file whose path sorts later (no fix)."
// Seed 1337 (every property). In process: `check()` over source text, no binary run.
// "That project" is the fourth clause's: module `a` lists `@acme/store` (a library of `id: 'store'`, `src/index.ts` re-exporting `store` from `./store.ts`), `modules/a/data.server.ts` imports and calls `store`. The library is the made-up `@acme/store`, written here as source text; no stdlib package is named.
// ASSUMPTIONS (spec silent or loose): a position is 1-based (line, then column) as every neighbouring file reads it; "at the argument" / "at the use" / "at the call" is the line of that span and a column from its first character to its last; `<name>` is "one lowerCamel segment" as in k.data;
// the argument message is asserted by its stable pieces (`<export> of "<name>"` and `name it '<id>.` for a literal, `<export> of a name that is not a string literal` otherwise): the text does not say whether `<id>` is filled in and `<lowerCamel>` literal; a use's message is asserted whole
// where `<export>` is the exported name `store`, and by its tail (`used as a value: the name it registers cannot be read here`) where the use is a namespace (the spec does not say what `<export>` is for `lib` as a value or `lib[k]`).
// The attacker shapes (conditional, default parameter, array element, getter, `Reflect.apply`, dynamic `import()`, `export *`, an alias of an alias, a destructured namespace, a tagged template, an optional call, a comma operand, a type assertion, a class field, a returned name) are not listed by the spec: the case asserts only the rule's
// contract, "followed to a judged name or one E1607 at the use", by calling or using the export with the bad name `main` and requiring at least one E1607 in the file. A shape that passes clean is a hole in the rule.
// A typeof in a type position is no use ("A name in a type position (`typeof x`) is no use."); a computed member `lib['store']` with a literal key is not asserted (the text says "static member" and "computed member" without placing a literal key).
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
const LIB_STORE = `${ROOT}/src/store.ts`;

/** The project of the fourth clause with `store.ts` of the library and the app file `data.server.ts` as given. */
function project(
  data: string,
  store = STORE_PARAM,
  extra: Files = [],
  index = "export { store } from './store.ts'\n",
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
    { path: LIB_STORE, source: store },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    ...extra,
  ];
}
const call = (arg: string): string => `import { store } from '${NAME}'\nexport const data = store(${arg})\n`;
const e1607 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1607");

/** The line and the column bounds of `arg` in the source of `call(arg)`. */
function spanOf(source: string, arg: string): { line: number; from: number; to: number } {
  const idx = source.indexOf(`store(${arg})`) + "store(".length;
  const before = source.slice(0, idx);
  return {
    line: before.split("\n").length,
    from: idx - before.lastIndexOf("\n"),
    to: idx - before.lastIndexOf("\n") + arg.length,
  };
}

test("In that project, with `store(name)` calling `register(name, ...)`, `store('a.main')` in `modules/a/data.server.ts` is no E1607", () => {
  expect(e1607(project(call("'a.main'")))).toEqual([]);
});

test("`store('main')` in `modules/a/data.server.ts` is one E1607 at the argument", () => {
  const source = call("'main'");
  const found = e1607(project(source));
  expect(found).toHaveLength(1);
  const at = spanOf(source, "'main'");
  expect(found[0]?.path).toBe(DATA);
  expect(found[0]?.line).toBe(at.line);
  expect(found[0]?.col).toBeGreaterThanOrEqual(at.from);
  expect(found[0]?.col).toBeLessThanOrEqual(at.to);
});

test("the library file reports no E1607, with `store('a.main')` and with `store('main')` at the app's call", () => {
  for (const arg of ["'a.main'", "'main'"]) {
    expect(e1607(project(call(arg))).filter((d) => d.path.startsWith(ROOT))).toEqual([]);
  }
});

test("an app call's argument that is a string literal `<id>.<name>` of the calling file's module with `<name>` one lowerCamel segment is no E1607; any other literal is one, at the argument (property)", () => {
  const camel = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/);
  fc.assert(
    fc.property(camel, (tail) => {
      expect(e1607(project(call(`'a.${tail}'`)))).toEqual([]);
      for (const bad of [`'a.${tail}.${tail}'`, `'a.X${tail}'`, `'${tail}'`, `'b.${tail}'`, `'store.${tail}'`]) {
        const found = e1607(project(call(bad)));
        expect(found, bad).toHaveLength(1);
        expect(found[0]?.path).toBe(DATA);
        expect(found[0]?.line).toBe(spanOf(call(bad), bad).line);
      }
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("`<id>` is the calling file's module: the same call from `modules/b/data.server.ts` needs `b.<name>`", () => {
  const files = (arg: string): Files => [
    ...project(call("'a.main'")),
    manifestFile({ id: "b", deps: [NAME] }),
    { path: "modules/b/data.server.ts", source: call(arg) },
  ];
  expect(e1607(files("'b.main'"))).toEqual([]);
  const wrong = e1607(files("'a.main'"));
  expect(wrong).toHaveLength(1);
  expect(wrong[0]?.path).toBe("modules/b/data.server.ts");
});

test("an app call whose argument for the parameter is not a string literal is one E1607, at the argument", () => {
  for (const arg of ["name", "`a.${name}`", "'a.' + 'main'"]) {
    const source = `import { store } from '${NAME}'\nconst name = 'a.main'\nexport const data = store(${arg})\n`;
    const found = e1607(project(source));
    expect(found, arg).toHaveLength(1);
    expect(found[0]?.path).toBe(DATA);
    expect(found[0]?.line).toBe(3);
    expect(found[0]?.col).toBeGreaterThanOrEqual((source.split("\n")[2]?.indexOf(arg) ?? 0) + 1);
  }
});

test("the call is read through a re-export: `store` is defined in `src/store.ts` and exported by `src/index.ts`, and the app imports the package", () => {
  expect(e1607(project(call("'main'")))).toHaveLength(1);
});

test("a library `register(name, ...)` whose name is no parameter of its exported function is one E1607 in the library file (k.data's rule)", () => {
  const store = `import { register } from '@keel/ctx'\n${IMPL}const name = 'main'\nexport function store() {\n  return register(name, { real: impl, shell: impl, sim: impl })\n}\n`;
  const found = e1607(project(call(""), store));
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe(LIB_STORE);
});

test("a library `register('store.main', ...)` in `store` is no E1607, and the app's call of it with no parameter is no E1607", () => {
  const store = `import { register } from '@keel/ctx'\n${IMPL}export function store() {\n  return register('store.main', { real: impl, shell: impl, sim: impl })\n}\n`;
  expect(e1607(project(call(""), store))).toEqual([]);
});

// ---- clause 8: no argument, duplicates across calls, a non-parameter name in the library ----
const here = (source: string, at: string): { line: number; col: number } => {
  const idx = source.indexOf(at);
  const before = source.slice(0, idx);
  return { line: before.split("\n").length, col: idx - before.lastIndexOf("\n") };
};
const inSpan = (d: { line: number; col: number } | undefined, at: { line: number; col: number }, len: number): void => {
  expect(d?.line).toBe(at.line);
  expect(d?.col).toBeGreaterThanOrEqual(at.col);
  expect(d?.col).toBeLessThanOrEqual(at.col + len);
};
const REG = "import { register } from '@keel/ctx'\n";
const lowerWord = fc.stringMatching(/^[a-z]{3,8}$/);

test("In the fifth bullet's project, `store()` with no argument in `modules/a/data.server.ts` is one E1607 at the call", () => {
  const source = "import { store } from '@acme/store'\nexport const data = store()\n";
  const found = e1607(project(source));
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe(DATA);
  inSpan(found[0], here(source, "store()"), "store()".length);
});

test("`store('a.main')` in both `modules/a/data.server.ts` and `modules/a/other.server.ts` is one E1607, in `other.server.ts`", () => {
  const files = project(call("'a.main'"), STORE_PARAM, [
    { path: "modules/a/other.server.ts", source: call("'a.main'") },
  ]);
  const found = e1607(files);
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe("modules/a/other.server.ts");
});

test("a name two calls of the export give in two files is one E1607, in the file whose path sorts later (property over the two file names)", () => {
  fc.assert(
    fc.property(fc.uniqueArray(lowerWord, { minLength: 2, maxLength: 2 }), ([x, y]) => {
      const [first, second] = [x ?? "aaa", y ?? "bbb"].sort();
      const files = [`modules/a/${first}.server.ts`, `modules/a/${second}.server.ts`].map((path) => ({
        path,
        source: call("'a.main'"),
      }));
      const found = e1607(project("export const none = 1\n", STORE_PARAM, files));
      expect(found).toHaveLength(1);
      expect(found[0]?.path).toBe(`modules/a/${second}.server.ts`);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a name a call of the export and a `register` give in two files is one E1607, in the file whose path sorts later (either file may hold the call)", () => {
  const reg = `${REG}${IMPL}export const x = register('a.main', { real: impl, shell: impl, sim: impl })\n`;
  for (const callFirst of [true, false]) {
    const files = [
      { path: "modules/a/aaa.server.ts", source: callFirst ? call("'a.main'") : reg },
      { path: "modules/a/zzz.server.ts", source: callFirst ? reg : call("'a.main'") },
    ];
    const found = e1607(project("export const none = 1\n", STORE_PARAM, files));
    expect(found, `call first: ${callFirst}`).toHaveLength(1);
    expect(found[0]?.path).toBe("modules/a/zzz.server.ts");
  }
});

test("`register(name, ...)` in the library with `name` a `const` of `store.ts` is one E1607 in the library file", () => {
  const store = `${REG}${IMPL}const name = 'store.main'\nexport function store(other: string) {\n  return register(name, { real: impl, shell: impl, sim: impl }) ?? other\n}\n`;
  const found = e1607(project(call("'a.main'"), store));
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe(LIB_STORE);
});

test("a library `register` whose name is a parameter of a function its file does not export, or a parameter an inner function shadows, is E1607 in the library file", () => {
  const S = "{ real: impl, shell: impl, sim: impl }";
  const helper = `${REG}${IMPL}function helper(name: string) {\n  return register(name, ${S})\n}\nexport function store() {\n  return helper('store.main')\n}\n`;
  const shadow = `${REG}${IMPL}export function store(name: string) {\n  const f = (name: string) => register(name, ${S})\n  return f(name)\n}\n`;
  for (const store of [helper, shadow]) {
    const found = e1607(project(call("'a.main'"), store));
    expect(found.map((d) => d.path)).toEqual([LIB_STORE]);
  }
});

test("a library `register` whose name is a parameter of the exported function, in a function inside it, is no E1607; a defaulted parameter counts, and a call with no argument is still one E1607 at the call", () => {
  const S = "{ real: impl, shell: impl, sim: impl }";
  const inner = `${REG}${IMPL}export function store(name: string) {\n  const f = () => register(name, ${S})\n  return f()\n}\n`;
  expect(e1607(project(call("'a.main'"), inner))).toEqual([]);
  const defaulted = `${REG}${IMPL}export function store(name = 'a.main') {\n  return register(name, ${S})\n}\n`;
  expect(e1607(project(call("'a.main'"), defaulted))).toEqual([]);
  const source = call("");
  const found = e1607(project(source, defaulted));
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe(DATA);
  inSpan(found[0], here(source, "store()"), "store()".length);
});

// ---- clause 10: the uses of a registering export ----
const GOOD = "'a.main'";
const BAD = "'main'";
const IMPORT = `import { store } from '${NAME}'\n`;
const NS = `import * as lib from '${NAME}'\n`;
/** `src` with its one `¤` marker removed, and where the marker stood. */
function marked(src: string): { source: string; line: number; col: number } {
  const idx = src.indexOf("¤");
  const source = src.replace("¤", "");
  const before = source.slice(0, idx);
  return { source, line: before.split("\n").length, col: idx - before.lastIndexOf("\n") };
}
const VALUE_MESSAGE = "store used as a value: the name it registers cannot be read here";
const TAIL = "used as a value: the name it registers cannot be read here";

// [name, source with `¤` before the use, length of the use, `<export>` as the message gives it ("" when only the tail is asserted)]
const VALUE_USES: [string, string, number, string][] = [
  ["passed as an argument", `${IMPORT}declare function run(f: unknown): void\nrun(¤store)\n`, 5, "store"],
  ["held in an array", `${IMPORT}export const list = [¤store]\n`, 5, "store"],
  ["held in an object as a value", `${IMPORT}export const o = { make: ¤store }\n`, 5, "store"],
  ["held in an object as a shorthand property", `${IMPORT}export const o = { ¤store }\n`, 5, "store"],
  ["a member `.call`", `${IMPORT}export const r = ¤store.call(undefined, 'a.main')\n`, 10, "store"],
  ["a member `.apply`", `${IMPORT}export const r = ¤store.apply(undefined, ['a.main'])\n`, 11, "store"],
  ["a member `.bind`", `${IMPORT}export const b = ¤store.bind(undefined)\n`, 10, "store"],
  ["an exported alias", `${IMPORT}export const db = ¤store\n`, 5, "store"],
  ["a `let` alias", `${IMPORT}let db = ¤store\nexport const r = db('a.main')\n`, 5, "store"],
  ["a computed member of a namespace import", `${NS}const k = 'store'\nexport const r = ¤lib[k]('a.main')\n`, 6, ""],
  ["the namespace as a value", `${NS}declare function run(f: unknown): void\nrun(¤lib)\n`, 3, ""],
];

for (const [what, src, len, exp] of VALUE_USES) {
  test(`${what} is one E1607 at the use, \`<export> used as a value: the name it registers cannot be read here\``, () => {
    const at = marked(src);
    const found = e1607(project(at.source));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe(DATA);
    inSpan(found[0], at, len);
    if (exp === "") expect(found[0]?.message.endsWith(TAIL)).toBe(true);
    else expect(found[0]?.message).toBe(VALUE_MESSAGE);
  });
}

test("a spread argument is no string literal: `store(...args)` is one E1607 at the argument", () => {
  const at = marked(`${IMPORT}declare const args: [string]\nexport const r = store(¤...args)\n`);
  const found = e1607(project(at.source));
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe(DATA);
  inSpan(found[0], at, "...args".length);
});

test("a name in a type position (`typeof store`) is no use: no E1607, alone or beside a followed call", () => {
  const type = `${IMPORT}export type T = typeof store\nexport const f: typeof store = store\n`;
  const onlyType = `${IMPORT}export type T = typeof store\n`;
  expect(e1607(project(onlyType))).toEqual([]);
  expect(e1607(project(`${onlyType}export const r = store('a.main')\n`))).toEqual([]);
  // the second line of `type` holds a value use of `store` as the initializer: exactly one E1607, not two
  expect(e1607(project(type))).toHaveLength(1);
});

// [name, project files besides data.server.ts, data.server.ts with `¤` before the argument, library index]
type Followed = [string, Files, string, string?];
const re = (path: string, source: string): Files => [{ path: `modules/a/${path}`, source }];
const FOLLOWED: Followed[] = [
  ["imported by name", [], `${IMPORT}export const r = store(¤ARG)\n`],
  ["imported by name under another local name", [], `import { store as s } from '${NAME}'\nexport const r = s(¤ARG)\n`],
  [
    "imported as the default",
    [],
    `import store from '${NAME}'\nexport const r = store(¤ARG)\n`,
    "export { store, store as default } from './store.ts'\n",
  ],
  [
    "re-exported by a project file with `export { x }`",
    re("re.ts", `${IMPORT}export { store }\n`),
    "import { store } from './re.ts'\nexport const r = store(¤ARG)\n",
  ],
  [
    "re-exported by a project file with `export { x as y } from`",
    re("re.ts", `export { store as y } from '${NAME}'\n`),
    "import { y } from './re.ts'\nexport const r = y(¤ARG)\n",
  ],
  [
    "re-exported by a project file with `export default x`",
    re("re.ts", `${IMPORT}export default store\n`),
    "import y from './re.ts'\nexport const r = y(¤ARG)\n",
  ],
  [
    "re-exported by a project file with `export { x } from`, two files deep",
    [...re("re1.ts", "export { store } from './re2.ts'\n"), ...re("re2.ts", `export { store } from '${NAME}'\n`)],
    "import { store } from './re1.ts'\nexport const r = store(¤ARG)\n",
  ],
  ["a `const` alias in the same file", [], `${IMPORT}const db = store\nexport const r = db(¤ARG)\n`],
  ["a static member of a namespace import", [], `${NS}export const r = lib.store(¤ARG)\n`],
];

for (const [what, extra, src, index] of FOLLOWED) {
  const files = (arg: string): Files => project(marked(src).source.replace("ARG", arg), STORE_PARAM, extra, index);
  test(`${what} is followed to its call: \`'a.main'\` is no E1607 and \`'main'\` one at the argument`, () => {
    expect(e1607(files(GOOD))).toEqual([]);
    const at = marked(src.replace("ARG", BAD));
    const found = e1607(project(at.source, STORE_PARAM, extra, index));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe(DATA);
    inSpan(found[0], at, BAD.length);
  });
}

test("a followed call is judged for each module alike (property: any `<name>` that is one lowerCamel segment is no E1607 by any followed form, any other is one)", () => {
  const camel = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/);
  fc.assert(
    fc.property(camel, fc.constantFrom(...FOLLOWED), (tail, [, extra, src, index]) => {
      const ok = project(marked(src).source.replace("ARG", `'a.${tail}'`), STORE_PARAM, extra, index);
      expect(e1607(ok)).toEqual([]);
      const bad = project(marked(src).source.replace("ARG", `'${tail}'`), STORE_PARAM, extra, index);
      expect(e1607(bad)).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

// An attacker's shapes: each must be followed to a judged name or one E1607 at the use. The name is bad (`main`), so a clean run is a hole.
const OTHER = "declare const other: (n: string) => unknown\ndeclare const cond: boolean\n";
const ATTACKS: [string, Files, string, string?][] = [
  [
    "a destructured import of a re-export chain two files deep",
    [...re("re1.ts", "export { store } from './re2.ts'\n"), ...re("re2.ts", `export { store } from '${NAME}'\n`)],
    "import * as ns from './re1.ts'\nconst { store: s } = ns\nexport const r = ¤s('main')\n",
  ],
  [
    "a conditional `(cond ? store : other)('x')`",
    [],
    `${IMPORT}${OTHER}export const r = (cond ? ¤store : other)('main')\n`,
  ],
  ["a default parameter `(f = store) => f('x')`", [], `${IMPORT}export const g = (f = ¤store) => f('main')\n`],
  ["an array element `[store][0]('x')`", [], `${IMPORT}export const r = [¤store][0]('main')\n`],
  ["a getter returning it", [], `${IMPORT}const o = { get f() { return ¤store } }\nexport const r = o.f('main')\n`],
  [
    "`Reflect.apply(store, undefined, ['x'])`",
    [],
    `${IMPORT}export const r = Reflect.apply(¤store, undefined, ['main'])\n`,
  ],
  [
    "a dynamic `import()` of the library",
    [],
    `export const r = (async () => (await ¤import('${NAME}')).store('main'))()\n`,
  ],
  [
    "`export *` from the library in a project file",
    re("re.ts", `export * from '${NAME}'\n`),
    "import { store } from './re.ts'\nexport const r = ¤store('main')\n",
  ],
  ["an alias of an alias", [], `${IMPORT}const a1 = ¤store\nconst a2 = a1\nexport const r = a2('main')\n`],
  ["a destructured namespace", [], `${NS}const { store: s } = ¤lib\nexport const r = s('main')\n`],
  ["a tagged template", [], `${IMPORT}export const r = ¤store\`main\`\n`],
  ["an optional call", [], `${IMPORT}export const r = ¤store?.('main')\n`],
  ["a comma operand `(0, store)('x')`", [], `${IMPORT}export const r = (0, ¤store)('main')\n`],
  ["a type assertion", [], `${IMPORT}export const r = (¤store as (n: string) => unknown)('main')\n`],
  ["a parenthesized callee", [], `${IMPORT}export const r = (¤store)('main')\n`],
  ["a class field", [], `${IMPORT}export class C {\n  f = ¤store\n}\n`],
  ["a returned name", [], `${IMPORT}export const g = () => ¤store\n`],
  [
    "the import of a re-exported default",
    re("re.ts", `export { default } from '${NAME}'\n`),
    "import f from './re.ts'\nexport const r = ¤f('main')\n",
    "export { store, store as default } from './store.ts'\n",
  ],
];

for (const [what, extra, src, index] of ATTACKS) {
  test(`${what} is followed to a judged name or one E1607 at the use (a clean run is a hole)`, () => {
    const at = marked(src);
    const found = e1607(project(at.source, STORE_PARAM, extra, index)).filter((d) => d.path === DATA);
    expect(found.length, `no E1607 in ${DATA}: the shape passes clean`).toBeGreaterThanOrEqual(1);
    const mainLines = at.source.split("\n").flatMap((l, i) => (l.includes("'main'") ? [i + 1] : []));
    expect(found.some((d) => d.line === at.line || mainLines.includes(d.line))).toBe(true);
  });
}
