// Spec: k.server-deps, the fifth Conformance clause, quoted whole:
// 5. "In that project, with `store(name)` calling `register(name, ...)`, `store('a.main')` in `modules/a/data.server.ts` is no E1607 and `store('main')` there is one E1607 at the argument; the library file reports none."
// Registration through a library: "In a library file, a `register` call whose name is a parameter of the exported function holding it is no E1607 (k.data); instead each app call of that export whose argument for the parameter is not a string literal `<id>.<name>`, `<id>` the calling file's module, is one E1607 at the argument."
// k.data Rules: "E1607, at `keel check`: a call of `@keel/ctx`'s `register` in a file under `modules/<id>/` whose name is not a string literal `<id>.<name>`, `<name>` one lowerCamel segment; or a name another app file registers too, reported at the call in the file whose path sorts later (no fix)."
// Seed 1337. "That project" is the fourth clause's: module `a` lists `@acme/store` (a library of `id: 'store'`, `src/index.ts` re-exporting `store` from `./store.ts`), `modules/a/data.server.ts` imports and calls `store`.
// The library is the made-up `@acme/store`, written here as source text; no stdlib package is named.
// ASSUMPTIONS (spec silent): "at the argument" is the argument's line and a column from its first character to its last (a literal from its opening to its closing quote); `check()` is given the library at `node_modules/@acme/store/` with its
// `package.json`, `module.ts` and ledger file, as library-rules.test.ts does; `<name>` is "one lowerCamel segment" as in k.data. The text says nothing of: an app call with no argument, a template literal without a substitution, a second app
// call of the export with an argument another app file already used (a duplicate name), a library `register` whose name is a local that is no parameter (read here as k.data's rule: E1607 at the library file).
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
function project(data: string, store = STORE_PARAM, extra: Files = []): Files {
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
    { path: `${ROOT}/src/index.ts`, source: "export { store } from './store.ts'\n" },
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
