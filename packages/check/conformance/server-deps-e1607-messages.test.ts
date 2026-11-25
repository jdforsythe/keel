// Spec: k.server-deps, the message of the argument of a registering export, and the clip widths, each quoted whole:
// Registration through a library, second paragraph: "In a library file, a `register` call whose name is a parameter of the exported function holding it (the innermost enclosing function with a parameter, plain or defaulted, of that name) is no E1607 (k.data); the name is judged where that export is called. Check traces every binding that may hold such an export: an import of it under any name; a namespace of a module that holds one (`import * as`, `import x = require`, an imported `export * as`); its declaration; a `const` alias or plain-keyed `const` destructuring of any of these; and a directly awaited literal `import()` of such a module. It crosses files through re-exports of any form and reads at most 8 files, the calling and the defining file counted. Every occurrence of such a binding is exactly one of three things: - a further binding the trace continues through: a `const` declaration (not an exported one), a plain destructuring key, `export { x }`, `export default x`, a static member of a namespace; - a call, whose argument for the parameter is judged as k.data judges a `register` name in the calling file: not a string literal `<id>.<name>`, `<id>` the calling module's id and `<name>` one lowerCamel segment, is one E1607 at the argument, and at the call when it has none (message `<export> of "<name>": name it '<id>.<lowerCamel>'`, or `<export> of a name that is not a string literal: ...`; a spread is no string literal); a name two such calls, or a call and a `register`, give in two files is one E1607 at the later file's; - one E1607 at the occurrence, message `<export> used as a value: the name it registers cannot be read here`: any other position (an optional call, `new`, `.call`, a computed, defaulted or rest key among them). A binding reached through more than 8 files is this at each occurrence, message `<export> comes through more than 8 files: the name it registers cannot be read here`."
// Registration through a library, third paragraph: "A name in a type position (`typeof x`, an annotation) carries no value and is no occurrence; a parameter of the same name hides the binding in its function. An `import(x)` with a computed specifier is an occurrence when a file it can reach holds such an export: for a relative template, the project files under its folder with its ending; for any other, always. `<export>` is an import's local, an alias's original, a member's or destructured key, a namespace's local, or `import()`. Any other non-literal library `register` name is E1607 in the library file. Code held in a string (`eval`, `new Function`) is out of scope."
// Rules: "A clipped E1167 `<name>` (28 units), E1607 `<name>` (30), `<f>` (40), `<other>` (36), `<export>` or `<id>` (20) ends in `...`, by k.check Diagnostics' clip at that width, and every message is within 89. E1167 an `env` entry that is not a string literal matching `[A-Z][A-Z0-9_]*`, or that is a key `DeployEnv` parses (`PORT`, `KEEL_SECRET`, `KEEL_ORIGIN`, `KEEL_DATABASE_URL`, `KEEL_ALLOW_ORIGINS`) or begins with `KEEL_PEER_`, at the entry: its line and the column of its first character, a string literal's opening quote (an `env` that is no array literal: at its value); messages `env entry is not a string literal` (an entry or an `env` that is no string literal), `env name "<name>" does not match [A-Z][A-Z0-9_]*`, and `env name "<name>" is a key DeployEnv reads` (a `DeployEnv` key, or a name in the pattern beginning with `KEEL_PEER_`); no fix · E1014 `keel build`: a bundled package file's `new URL(<a>, import.meta.url)` whose `<a>` is of no form Files a bundled package reads copies or leaves alone, names a missing path, or names a path another bundled package file names for a file of other bytes; located at the package file (a library's at `node_modules/<name>/<f>`, any other by its path from its last `node_modules/` folder); messages `reads <f>, which is missing`, `reads <f>, outside its own folder`, `reads <f>, as <other> reads another file`, `reads new URL(x, import.meta.url) with x no string literal`, `<f>` the first argument as written, a leading `./` kept, `<other>` the other package file as located; the build fails and writes no `dist/<name>/`."
// Seed 1337 (every property). In process: `check()` over source text. The library is the made-up `@acme/store` (`store(name)` calls `register(name, ...)`); module `<id>` lists it and calls `store(...)` in `modules/<id>/data.server.ts`.
// ASSUMPTIONS (spec silent): the message is `<export> of "<name>": name it '<id>.<lowerCamel>'` with `<lowerCamel>` the literal text, `<id>` the calling module's id (clipped to 20 units) and `<export>` the local the import binds (clipped to 20), `<name>` the literal's text, clipped at 30 units by Rules: whole to 30 units, a longer name ends in `...`, within 89;
// a clipped part keeps width - 3 units (one fewer before the first half of a surrogate pair) then `...`; the whole message is then clipped to 89 by k.check's rule. The text after `: ` of `<export> of a name that is not a string literal: ...` is not given, so only the part before it is asserted.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, manifestFile } from "./module-support.ts";

const NAME = "@acme/store";
const ROOT = `node_modules/${NAME}`;
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const IMPL = "const impl = () => ({ title: () => 'lib' })\n";
const STORE_PARAM = `import { register } from '@keel/ctx'\n${IMPL}export function store(name: string) {\n  return register(name, { real: impl, shell: impl, sim: impl })\n}\n`;

/** The project: module `id` lists the library and holds `data` in `modules/<id>/data.server.ts`. */
function project(id: string, data: string): Files {
  return [
    manifestFile({ id, deps: [NAME] }),
    { path: `modules/${id}/data.server.ts`, source: data },
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
  ];
}
const e1607 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1607");

/** k.check's clip rule at `width` units. */
const clipTo = (n: string, width: number): string => {
  if (n.length <= width) return n;
  const code = n.charCodeAt(width - 4);
  return `${n.slice(0, code >= 0xd800 && code <= 0xdbff ? width - 4 : width - 3)}...`;
};
const expected = (exp: string, name: string, id: string): string =>
  clipTo(`${clipTo(exp, 20)} of "${clipTo(name, 30)}": name it '${clipTo(id, 20)}.<lowerCamel>'`, 89);

const lowers = (n: number, c = "x"): string => c.repeat(n);
function messageOf(id: string, exp: string, name: string): string | undefined {
  const local = exp === "store" ? "store" : `store as ${exp}`;
  const data = `import { ${local} } from '${NAME}'\nexport const r = ${exp}('${name}')\n`;
  const found = e1607(project(id, data));
  expect(found, `${id} ${exp} ${name}`).toHaveLength(1);
  return found[0]?.message;
}

test("a literal name that is no `<id>.<name>` gives `<export> of \"<name>\": name it '<id>.<lowerCamel>'`, `<id>` the calling module's id and `<lowerCamel>` as written", () => {
  expect(messageOf("a", "store", "main")).toBe(`store of "main": name it 'a.<lowerCamel>'`);
  expect(messageOf("orders", "store", "main")).toBe(`store of "main": name it 'orders.<lowerCamel>'`);
});

test("`<id>` is the calling module's id, and a name of another module's id is refused with the calling one named (property over ids)", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{3,10}$/), fc.stringMatching(/^[a-z]{3,10}$/), (id, other) => {
      fc.pre(id !== other);
      expect(messageOf(id, "store", `${other}.main`)).toBe(`store of "${other}.main": name it '${id}.<lowerCamel>'`);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("`<name>` of the argument message: a literal of up to 30 units is whole, a longer one ends in `...` and keeps 27 and the message is within 89 (property over its length)", () => {
  for (const n of [29, 30]) {
    const name = lowers(n);
    expect(messageOf("a", "store", name)).toBe(`store of "${name}": name it 'a.<lowerCamel>'`);
  }
  fc.assert(
    fc.property(fc.integer({ min: 40, max: 120 }), (n) => {
      const message = messageOf("a", "store", lowers(n)) ?? "";
      expect(message.length).toBeLessThanOrEqual(89);
      expect(message.includes(`..."`) || message.endsWith("...")).toBe(true);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("`<id>` is clipped to 20 units: 19 and 20 units whole, 21 ends in `...` and keeps 17", () => {
  for (const n of [19, 20, 21]) {
    const id = lowers(n, "m");
    expect(messageOf(id, "store", "main")).toBe(expected("store", "main", id));
    expect(messageOf(id, "store", "main")?.includes("...")).toBe(n > 20);
  }
});

test("`<export>`, the local an import binds, is clipped to 20 units: 19 and 20 whole, 21 ends in `...` and keeps 17", () => {
  for (const n of [19, 20, 21]) {
    const local = lowers(n, "s");
    expect(messageOf("a", local, "main")).toBe(expected(local, "main", "a"));
    expect(messageOf("a", local, "main")?.includes("...")).toBe(n > 20);
  }
});

test("`<export>`, the key read off a namespace, is clipped to 20 units (a namespace member of 21 units)", () => {
  const key = lowers(21, "k");
  const store = STORE_PARAM.replace("export function store", `export function ${key}`);
  const files = project("a", `import * as lib from '${NAME}'\nexport const r = lib.${key}('main')\n`).map((f) =>
    f.path === `${ROOT}/src/store.ts`
      ? { path: f.path, source: store }
      : f.path === `${ROOT}/src/index.ts`
        ? { path: f.path, source: `export { ${key} } from './store.ts'\n` }
        : f,
  );
  const found = e1607(files);
  expect(found).toHaveLength(1);
  expect(found[0]?.message).toBe(expected(key, "main", "a"));
});

test("every message is within 89 units, `<export>`, `<name>` and `<id>` all at their widest (property)", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 15, max: 45 }),
      fc.integer({ min: 15, max: 45 }),
      fc.integer({ min: 20, max: 60 }),
      (e, i, n) => {
        const message = messageOf(lowers(i, "m"), lowers(e, "s"), lowers(n, "n")) ?? "";
        expect(message.length).toBeLessThanOrEqual(89);
        expect(message.startsWith(clipTo(lowers(e, "s"), 20))).toBe(true);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("a call with no argument and one whose argument is no string literal give `<export> of a name that is not a string literal: ...`", () => {
  for (const call of ["store()", "store(name)", "store(`a.${name}`)"]) {
    const data = `import { store } from '${NAME}'\nconst name = 'a.main'\nexport const r = ${call}\n`;
    const found = e1607(project("a", data));
    expect(found, call).toHaveLength(1);
    expect(found[0]?.message.startsWith("store of a name that is not a string literal: "), found[0]?.message).toBe(
      true,
    );
    expect(found[0]?.message.length).toBeLessThanOrEqual(89);
  }
});

test("`<name>` is clipped to 30 units: 29 and 30 units whole, 31 ends in `...` and keeps 27", () => {
  for (const n of [29, 30, 31]) {
    const name = lowers(n);
    const message = messageOf("a", "store", name);
    expect(message).toBe(expected("store", name, "a"));
    expect(message?.includes(`${lowers(27)}..."`)).toBe(n > 30);
  }
});
