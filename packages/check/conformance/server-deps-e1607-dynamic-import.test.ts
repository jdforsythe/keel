// Spec: k.server-deps, Registration through a library, third paragraph's computed `import()` and the second's, each quoted whole:
// "In a library file, a `register` call whose name is a parameter of the exported function holding it (the innermost enclosing function with a parameter, plain or defaulted, of that name) is no E1607 (k.data); the name is judged where that export is called. Check traces every binding that may hold such an export: an import of it under any name; a namespace of a module that holds one (`import * as`, `import x = require`, an imported `export * as`); its declaration; a `const` alias or plain-keyed `const` destructuring of any of these; and a directly awaited literal `import()` of such a module. It crosses files through re-exports of any form and reads at most 8 files, the calling and the defining file counted. Every occurrence of such a binding is exactly one of three things: - a further binding the trace continues through: a `const` declaration (not an exported one), a plain destructuring key, `export { x }`, `export default x`, a static member of a namespace; - a call, whose argument for the parameter is judged as k.data judges a `register` name in the calling file: not a string literal `<id>.<name>`, `<id>` the calling module's id and `<name>` one lowerCamel segment, is one E1607 at the argument, and at the call when it has none (message `<export> of "<name>": name it '<id>.<lowerCamel>'`, or `<export> of a name that is not a string literal: ...`; a spread is no string literal); a name two such calls, or a call and a `register`, give in two files is one E1607 at the later file's; - one E1607 at the occurrence, message `<export> used as a value: the name it registers cannot be read here`: any other position (an optional call, `new`, `.call`, a computed, defaulted or rest key among them). A binding reached through more than 8 files is this at each occurrence, message `<export> comes through more than 8 files: the name it registers cannot be read here`."
// "A name in a type position (`typeof x`, an annotation) carries no value and is no occurrence; a parameter of the same name hides the binding in its function. An `import(x)` with a computed specifier is an occurrence when a file it can reach holds such an export: for a relative template, the project files under its folder with its ending; for any other, always. `<export>` is an import's local, an alias's original, a member's or destructured key, a namespace's local, or `import()`. Any other non-literal library `register` name is E1607 in the library file. Code held in a string (`eval`, `new Function`) is out of scope."
// Seed 1337 (every property). In process: `check()` over source text. The library is the made-up `@acme/store`; the call is in `modules/a/data.server.ts`; the files an `import()` can reach sit under `modules/a/`.
// ASSUMPTIONS (spec silent): "the project files under its folder with its ending" is read as every project file below the template's folder, at any depth, whose path ends with the template's ending (`.ts`); a file "holds such an export" when it re-exports the library's `store` (`export { store } from '@acme/store'`); a project file the relative template cannot reach holds no occurrence. The finding is at the `import()`, message `import() used as a value: the name it registers cannot be read here`.
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
const MESSAGE = "import() used as a value: the name it registers cannot be read here";

function project(data: string, extra: Files = []): Files {
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
    { path: `${ROOT}/src/store.ts`, source: STORE_PARAM },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    ...extra,
  ];
}
const e1607 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1607");
const folder = fc.stringMatching(/^[A-Z][a-z]{2,6}$/);
const locale = fc.stringMatching(/^[a-z]{2}$/);
const load = (dir: string): string => `export const load = (locale: string) => import(\`./${dir}/\${locale}.ts\`)\n`;
const REGISTERING = `export { store } from '${NAME}'\n`;
const PLAIN = "export const hello = 'hello'\n";

test("a relative template `import()` whose folder holds no project file with its ending that holds a registering export is no E1607 (a locale file import, property over the folder and the locale names)", () => {
  fc.assert(
    fc.property(folder, locale, (dir, name) => {
      const files: Files = [{ path: `modules/a/${dir}/${name}.ts`, source: PLAIN }];
      expect(e1607(project(load(dir), files))).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a relative template `import()` is one E1607 at the `import()` when a project file under its folder with its ending holds a registering export, message `import() used as a value: the name it registers cannot be read here` (property over the folder, and the depth)", () => {
  fc.assert(
    fc.property(folder, locale, fc.boolean(), (dir, name, deep) => {
      const where = deep ? `modules/a/${dir}/sub/${name}.ts` : `modules/a/${dir}/${name}.ts`;
      const found = e1607(project(load(dir), [{ path: where, source: REGISTERING }]));
      expect(found).toHaveLength(1);
      expect(found[0]?.path).toBe(DATA);
      expect(found[0]?.line).toBe(1);
      expect(found[0]?.message).toBe(MESSAGE);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a relative template `import()` is no E1607 when the registering export lies outside its folder or has another ending than the template's", () => {
  fc.assert(
    fc.property(folder, folder, locale, (dir, other, name) => {
      fc.pre(dir !== other);
      const outside = [{ path: `modules/a/${other}/${name}.ts`, source: REGISTERING }];
      expect(e1607(project(load(dir), outside))).toEqual([]);
      const ending = [{ path: `modules/a/${dir}/${name}.json`, source: REGISTERING }];
      expect(e1607(project(load(dir), ending))).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("an `import()` with a computed specifier that is not a relative template is always an occurrence: one E1607 at the `import()`, whatever the project holds", () => {
  const forms = [
    "declare const spec: string\nexport const p = import(spec)\n",
    "declare const x: string\nexport const p = import(`pkg/${x}`)\n",
    "declare const x: string\nexport const p = import(`/abs/${x}.ts`)\n",
    "declare const x: string\nexport const p = import(`https://example.com/${x}.js`)\n",
  ];
  for (const data of forms) {
    const found = e1607(project(data));
    expect(found, data).toHaveLength(1);
    expect(found[0]?.path).toBe(DATA);
    expect(found[0]?.message).toBe(MESSAGE);
  }
});
