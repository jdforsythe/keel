// Spec: k.server-deps, Registration through a library, second and third paragraphs, each quoted whole:
// "In a library file, a `register` call whose name is a parameter of the exported function holding it (the innermost enclosing function with a parameter, plain or defaulted, of that name) is no E1607 (k.data); the name is judged where that export is called. Check traces every binding that may hold such an export: an import of it under any name; a namespace of a module that holds one (`import * as`, `import x = require`, an imported `export * as`); its declaration; a `const` alias or plain-keyed `const` destructuring of any of these; and a directly awaited literal `import()` of such a module. It crosses files through re-exports of any form and reads at most 8 files, the calling and the defining file counted. Every occurrence of such a binding is exactly one of three things: - a further binding the trace continues through: a `const` declaration (not an exported one), a plain destructuring key, `export { x }`, `export default x`, a static member of a namespace; - a call, whose argument for the parameter is judged as k.data judges a `register` name in the calling file: not a string literal `<id>.<name>`, `<id>` the calling module's id and `<name>` one lowerCamel segment, is one E1607 at the argument, and at the call when it has none (message `<export> of "<name>": name it '<id>.<lowerCamel>'`, or `<export> of a name that is not a string literal: ...`; a spread is no string literal); a name two such calls, or a call and a `register`, give in two files is one E1607 at the later file's; - one E1607 at the occurrence, message `<export> used as a value: the name it registers cannot be read here`: any other position (an optional call, `new`, `.call`, a computed, defaulted or rest key among them). A binding reached through more than 8 files is this at each occurrence, message `<export> comes through more than 8 files: the name it registers cannot be read here`."
// "A name in a type position (`typeof x`, an annotation) carries no value and is no occurrence; a parameter of the same name hides the binding in its function. An `import(x)` with a computed specifier is an occurrence when a file it can reach holds such an export: for a relative template, the project files under its folder with its ending; for any other, always. `<export>` is an import's local, an alias's original, a member's or destructured key, a namespace's local, or `import()`. Any other non-literal library `register` name is E1607 in the library file. Code held in a string (`eval`, `new Function`) is out of scope."
// Seed 1337 (every property). In process: `check()` over source text. The library is the made-up `@acme/store`: `src/index.ts` re-exports `store` from `./store.ts`, which calls `register(name, ...)` with `name` the parameter of `store`. Module `a` lists it; the path ends in a call in `modules/a/data.server.ts`.
// The path is built from the rule, not from a list of forms: re-export files (`export { x }`, renamed, `export *`, `export * as`, `export default x`), then an import (named, default, namespace, `import x = require`, a directly awaited literal `import()`), then in-file steps (`const` alias, static member, plain-keyed destructuring), then a call. Each project re-export file is one file; the calling file, `src/index.ts` and `src/store.ts` are three more, so 5 project re-export files make 8 files, the bound.
// ASSUMPTIONS (spec silent): a position is 1-based; "at the occurrence" is the line of that statement; a statement holds one occurrence. A re-export file with an occurrence in it breaks the chain below it, so what follows is not asserted, only that the one E1607 is at that file's line. Past the bound the `<export>` of the message is the local of a named import (the one case the spec words plainly).
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
const TAIL = "used as a value: the name it registers cannot be read here";
const BOUND_MESSAGE = (local: string): string =>
  `${local} comes through more than 8 files: the name it registers cannot be read here`;

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

type Hold = { kind: "mod" | "fn" | "nsval"; name: string };
type Built = { files: Files; spec: string; hold: Hold; holds: Hold[]; specs: string[] };

const importOf = (from: string, name: string, local: string): string =>
  name === "default" ? `import ${local} from '${from}'` : `import { ${name} as ${local} } from '${from}'`;

/** The project re-export files a pick list builds, each re-exporting the one before; `noNs` leaves out `export * as`. */
function chain(picks: number[], noNs = false): Built {
  const files: { path: string; source: string }[] = [];
  const holds: Hold[] = [];
  const specs: string[] = [];
  let prev = NAME;
  let hold: Hold = { kind: "mod", name: "store" };
  picks.forEach((p, i) => {
    holds.push(hold);
    specs.push(prev);
    const alt = `n${i}`;
    let source: string;
    let next: Hold = hold;
    if (hold.kind === "mod") {
      const o = p % (noNs ? 2 : 3);
      if (o === 0) source = `export * from '${prev}'\n`;
      else if (o === 1) {
        source = `export { store as ${alt} } from '${prev}'\n`;
        next = { kind: "fn", name: alt };
      } else {
        source = `export * as ${alt} from '${prev}'\n`;
        next = { kind: "nsval", name: alt };
      }
    } else {
      const o = p % (hold.name === "default" ? 2 : 4);
      if (o === 0) {
        source =
          hold.name === "default"
            ? `export { default as ${alt} } from '${prev}'\n`
            : `export { ${hold.name} as ${alt} } from '${prev}'\n`;
        next = { kind: hold.kind, name: alt };
      } else if (o === 1) {
        source = `${importOf(prev, hold.name, "v")}\nexport default v\n`;
        next = { kind: hold.kind, name: "default" };
      } else if (o === 2) source = `export * from '${prev}'\n`;
      else source = `export { ${hold.name} } from '${prev}'\n`;
    }
    files.push({ path: `modules/a/re${i}.ts`, source });
    prev = `./re${i}.ts`;
    hold = next;
  });
  return { files, spec: prev, hold, holds, specs };
}

type Shape = { chain: number[]; start: number; local: number; steps: number[] };
type Binding = { kind: "fn" | "ns"; name: string };
type Path = { head: string[]; stmts: string[]; bindings: Binding[]; dynamic: boolean; call: (arg: string) => string };
const HEAD = [
  "declare function run(f: unknown): void",
  "declare const cond: boolean",
  "declare const k: 'store'",
  "declare const other: unknown",
];
const FIRST = HEAD.length + 1; // the line of the import; the consumer of binding j is at FIRST + 1 + j

/** The calling file's path from the built chain: the import, the in-file steps, then the call. */
function route(built: Built, s: Shape, fnOnly = false): Path {
  const { spec, hold } = built;
  const fnLocal = s.local % 2 === 0 ? "store" : "f0";
  const nsLocal = s.local % 2 === 0 ? "lib" : "n0";
  let importLine: string;
  let first: Binding;
  let dynamic = false;
  if (hold.kind === "mod") {
    const options: [string, Binding, boolean][] = [
      [`import { store as ${fnLocal} } from '${spec}'`, { kind: "fn", name: fnLocal }, false],
    ];
    if (!fnOnly) {
      options.push(
        [`import * as ${nsLocal} from '${spec}'`, { kind: "ns", name: nsLocal }, false],
        [`const ${nsLocal} = await import('${spec}')`, { kind: "ns", name: nsLocal }, true],
      );
      if (spec === NAME) options.push([`import ${nsLocal} = require('${spec}')`, { kind: "ns", name: nsLocal }, false]);
    }
    const pick = options[s.start % options.length] ?? options[0];
    importLine = pick?.[0] ?? "";
    first = pick?.[1] ?? { kind: "fn", name: fnLocal };
    dynamic = pick?.[2] ?? false;
  } else if (hold.kind === "fn") {
    importLine = importOf(spec, hold.name, fnLocal);
    first = { kind: "fn", name: fnLocal };
  } else {
    importLine = importOf(spec, hold.name, nsLocal);
    first = { kind: "ns", name: nsLocal };
  }
  const bindings: Binding[] = [first];
  const stmts: string[] = [importLine];
  if (!fnOnly) {
    s.steps.forEach((p, j) => {
      const cur = bindings[j];
      if (cur === undefined) return;
      const f = `f${j + 1}`;
      if (cur.kind === "fn") {
        stmts.push(`const ${f} = ${cur.name}`);
        bindings.push({ kind: "fn", name: f });
        return;
      }
      const o = p % 4;
      if (o === 0) {
        stmts.push(`const n${j + 1} = ${cur.name}`);
        bindings.push({ kind: "ns", name: `n${j + 1}` });
      } else if (o === 1) {
        stmts.push(`const ${f} = ${cur.name}.store`);
        bindings.push({ kind: "fn", name: f });
      } else if (o === 2) {
        stmts.push(`const { store: ${f} } = ${cur.name}`);
        bindings.push({ kind: "fn", name: f });
      } else {
        stmts.push(`const { store } = ${cur.name}`);
        bindings.push({ kind: "fn", name: "store" });
      }
    });
  }
  const last = bindings[bindings.length - 1] ?? first;
  const call = (arg: string): string =>
    last.kind === "fn" ? `export const r = ${last.name}('${arg}')` : `export const r = ${last.name}.store('${arg}')`;
  return { head: HEAD, stmts, bindings, dynamic, call };
}
const source = (p: Path, arg: string, extra: string[] = []): string =>
  `${[...p.head, ...p.stmts, p.call(arg), ...extra].join("\n")}\n`;

const FN_OCC: [string, (b: string) => string][] = [
  ["a `let`", (b) => `let o = ${b}`],
  ["a computed-free optional call", (b) => `export const o = ${b}?.('a.main')`],
  ["an argument", (b) => `run(${b})`],
  ["an array element", (b) => `export const o = [${b}]`],
  ["a returned value", (b) => `export const o = () => ${b}`],
  ["a conditional", (b) => `export const o = cond ? ${b} : undefined`],
  ["a spread", (b) => `export const o = [...${b}]`],
  ["`new`", (b) => `export const o = new ${b}('a.main')`],
  ["a tagged template", (b) => `export const o = ${b}\`a.main\``],
  ["a bare decorator", (b) => `@${b} class C {}`],
  ["`.call`", (b) => `export const o = ${b}.call(undefined, 'a.main')`],
  ["an exported alias", (b) => `export const o = ${b}`],
];
const NS_OCC: [string, (b: string) => string][] = [
  ["a `let`", (b) => `let o = ${b}`],
  ["an argument", (b) => `run(${b})`],
  ["an array element", (b) => `export const o = [${b}]`],
  ["a returned value", (b) => `export const o = () => ${b}`],
  ["a conditional", (b) => `export const o = cond ? ${b} : undefined`],
  ["an object spread", (b) => `export const o = { ...${b} }`],
  ["a computed member", (b) => `export const o = ${b}[k]('a.main')`],
  ["a defaulted key", (b) => `const { store: o = other } = ${b}`],
  ["a rest key", (b) => `const { ...o } = ${b}`],
  ["a computed key", (b) => `const { [k]: o } = ${b}`],
  ["`Object.assign`", (b) => `export const o = Object.assign({}, ${b})`],
  ["an exported alias", (b) => `export const o = ${b}`],
];
const occurrenceOf = (b: Binding, p: number): [string, string] => {
  const table = b.kind === "fn" ? FN_OCC : NS_OCC;
  const [what, make] = table[p % table.length] ?? table[0] ?? ["", () => ""];
  return [what, make(b.name)];
};
const DYNAMIC_OCC: [string, (s: string) => string][] = [
  ["a stored `import()`", (s) => `export const o = import('${s}')`],
  ["a passed `import()`", (s) => `run(import('${s}'))`],
  ["an `import()` followed by `.then`", (s) => `export const o = import('${s}').then((m) => m.store('a.main'))`],
  ["a `let` of an awaited `import()`", (s) => `let o = await import('${s}')`],
];

const shape = fc.record({
  chain: fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 5 }),
  start: fc.nat(99),
  local: fc.nat(99),
  steps: fc.array(fc.nat(99), { maxLength: 3 }),
});
const GOOD = "a.main";
const BAD = "main";

test("a path from a registering export to a call, through up to 5 re-export files (8 files with the calling and the defining file), an import and in-file steps, is traced: `'a.main'` is no E1607 and `'main'` is one at the argument and none elsewhere (property)", () => {
  fc.assert(
    fc.property(shape, (s) => {
      const built = chain(s.chain);
      const p = route(built, s);
      const label = JSON.stringify([s, built.files.map((f) => f.source), p.stmts]);
      expect(e1607(project(source(p, GOOD), built.files)), label).toEqual([]);
      const found = e1607(project(source(p, BAD), built.files));
      expect(found, label).toHaveLength(1);
      expect(found[0]?.path, label).toBe(DATA);
      expect(found[0]?.line, label).toBe(FIRST + p.stmts.length);
    }),
    { seed: SEED, numRuns: 150 },
  );
});

test("the same path with one step replaced by an occurrence outside a further binding, a judged call and the rest (a `let`, an optional call, an argument, an array element, a returned value, a conditional, a spread, `new`, a tagged template, a bare decorator, `.call`, an exported alias, a computed member, a defaulted, rest or computed key, `Object.assign`) is exactly one E1607 at that step's line and none elsewhere (property)", () => {
  fc.assert(
    fc.property(shape, fc.nat(99), fc.nat(99), (s, at, occ) => {
      const built = chain(s.chain);
      const p = route(built, s);
      const consumers = p.bindings.length; // the consumer of binding j is the statement after it
      const choices = consumers + (built.files.length > 0 ? 1 : 0);
      const c = at % choices;
      const label = JSON.stringify([s, at, occ, p.stmts]);
      if (c < consumers) {
        const b = p.bindings[c];
        if (b === undefined) return;
        const [what, stmt] = occurrenceOf(b, occ);
        const seq = [...p.stmts, p.call(GOOD)];
        seq[c + 1] = stmt;
        const found = e1607(project(`${[...p.head, ...seq].join("\n")}\n`, built.files));
        expect(found, `${what} ${label}`).toHaveLength(1);
        expect(found[0]?.path, label).toBe(DATA);
        expect(found[0]?.line, `${what} ${label}`).toBe(FIRST + 1 + c);
        expect(found[0]?.message.endsWith(TAIL), found[0]?.message).toBe(true);
        return;
      }
      // an occurrence inside a re-export file: the one file at index `i`
      const i = occ % built.files.length;
      const hold = built.holds[i];
      const from = built.specs[i];
      if (hold === undefined || from === undefined) return;
      const b: Binding =
        hold.kind === "mod"
          ? { kind: s.start % 2 === 0 ? "fn" : "ns", name: "v" }
          : { kind: hold.kind === "fn" ? "fn" : "ns", name: "v" };
      const head =
        hold.kind === "mod"
          ? b.kind === "fn"
            ? `import { store as v } from '${from}'`
            : `import * as v from '${from}'`
          : importOf(from, hold.name, "v");
      const [what, stmt] = occurrenceOf(b, occ);
      const files = built.files.map((f, j) => (j === i ? { path: f.path, source: `${head}\n${stmt}\n` } : f));
      const found = e1607(project(source(p, GOOD), files));
      expect(found, `${what} in re${i}.ts ${label}`).toHaveLength(1);
      expect(found[0]?.path, label).toBe(`modules/a/re${i}.ts`);
      expect(found[0]?.line, label).toBe(2);
    }),
    { seed: SEED, numRuns: 250 },
  );
});

test("a directly awaited literal `import()` of a module that holds a registering export, replaced by an occurrence (stored, passed, `.then`, held in a `let`), is exactly one E1607 at the `import()`, message `import() used as a value: the name it registers cannot be read here`", () => {
  fc.assert(
    fc.property(fc.array(fc.nat(99), { maxLength: 5 }), fc.nat(99), (picks, occ) => {
      const built = chain(picks, true);
      if (built.hold.kind !== "mod") return;
      const [, make] = DYNAMIC_OCC[occ % DYNAMIC_OCC.length] ?? DYNAMIC_OCC[0] ?? ["", () => ""];
      const data = `${[...HEAD, make(built.spec)].join("\n")}\n`;
      const found = e1607(project(data, built.files));
      expect(found).toHaveLength(1);
      expect(found[0]?.path).toBe(DATA);
      expect(found[0]?.line).toBe(FIRST);
      expect(found[0]?.message).toBe(`import() ${TAIL}`);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("a name in a type position (`typeof x` in a type, an `import type`) beside a traced path is no occurrence: no finding for a good name, and a bad name is still the one E1607 at its argument (property)", () => {
  fc.assert(
    fc.property(shape, fc.nat(99), (s, at) => {
      const built = chain(s.chain);
      const p = route(built, s);
      const b = p.bindings[at % p.bindings.length];
      if (b === undefined) return;
      const extra = [
        `export type T = typeof ${b.name}`,
        `import type { store as Q } from '${NAME}'`,
        "export type U = typeof Q",
      ];
      const label = JSON.stringify([s, at]);
      expect(e1607(project(source(p, GOOD, extra), built.files)), label).toEqual([]);
      const found = e1607(project(source(p, BAD, extra), built.files));
      expect(found, label).toHaveLength(1);
      expect(found[0]?.line, label).toBe(FIRST + p.stmts.length);
    }),
    { seed: SEED, numRuns: 80 },
  );
});

test("the bound at its edge: a named export reached through 8 files (5 project re-export files, the calling file and the library's two) is judged, a name that is no `<id>.<name>` is one E1607 at the argument", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 5, maxLength: 5 }),
      fc.nat(99),
      (picks, local) => {
        const built = chain(picks, true);
        const p = route(built, { chain: picks, start: 0, local, steps: [] }, true);
        expect(e1607(project(source(p, GOOD), built.files))).toEqual([]);
        const found = e1607(project(source(p, BAD), built.files));
        expect(found).toHaveLength(1);
        expect(found[0]?.line).toBe(FIRST + 1);
        expect(found[0]?.message.startsWith(`${p.bindings[0]?.name} of "main"`)).toBe(true);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("past the bound: a named export reached through 9 files or more (6 to 8 project re-export files) is one E1607 at the use, message `<export> comes through more than 8 files: the name it registers cannot be read here` whole, whether the name is good or bad (property)", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 6, maxLength: 8 }),
      fc.nat(99),
      fc.boolean(),
      (picks, local, good) => {
        const built = chain(picks, true);
        const p = route(built, { chain: picks, start: 0, local, steps: [] }, true);
        const found = e1607(project(source(p, good ? GOOD : BAD), built.files));
        expect(found, `${picks.length} files`).toHaveLength(1);
        expect(found[0]?.path).toBe(DATA);
        expect(found[0]?.line).toBe(FIRST + 1);
        expect(found[0]?.message).toBe(BOUND_MESSAGE(p.bindings[0]?.name ?? ""));
      },
    ),
    { seed: SEED, numRuns: 40 },
  );
});

test("past the bound, every use of the binding is the bound's E1607, one for each (two calls give two, at their lines)", () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 6, maxLength: 8 }), (picks) => {
      const built = chain(picks, true);
      const data = `${[`${importOf(built.spec, built.hold.name, "store")}`, "export const a = store('a.main')", "export const b = store('main')"].join("\n")}\n`;
      const found = e1607(project(data, built.files));
      expect(found.map((d) => d.line)).toEqual([2, 3]);
      for (const d of found) expect(d.message).toBe(BOUND_MESSAGE("store"));
    }),
    { seed: SEED, numRuns: 20 },
  );
});
