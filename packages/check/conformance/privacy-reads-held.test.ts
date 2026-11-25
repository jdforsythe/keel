// Spec: k.privacy-reads, Held "The read follows a binding only when it is a top-level `const` of a project file. One bound to an object or array literal, or a `const` alias of one, is held when every reference to it, by lexical scope, in every checked file (its own, each importing it by name or through re-exports, and each `ns.<name>` of a namespace import of its file), is one the read takes: a field value, a spread, an array element, a branch of `?:`, an argument of a call `s.<name>(…)` on the `@keel/schema` namespace, a non-computed member read standing in one of those places, an `export` or re-export of it, the initializer of a `const` alias that is itself held, or a type (`typeof x`). Any other reference leaves it not held: an assignment's target or the root of one, `delete`, `++`, a destructuring source, any other call's argument or receiver (`Object.assign(x, …)`, `assign(x, …)` after `const { assign } = Object`, `f(x)`, `x.push(…)`), a value returned, thrown or stored. So does a namespace object of its file used other than as `ns.<name>` (passed, destructured, a computed member) and an `import()` or `export * as` of its file. A schema `@keel/schema` makes needs no such rule: it is frozen (k.schema Frozen), so no reference changes it. A file outside the checked files is not read; a package does not import an app file."
// Spec: k.privacy-reads, Readers "`schemaHolds(expr, input, names): 'yes' | 'unknown' | 'no'` reads the schema expression `expr` of `input.file` through `const`s, project imports and re-exports, object literal fields, spreads, array elements, call arguments, a call's receiver (`X.optional()` reads `X`) and both branches of `?:`. A part is listed when it is `{ from, name }` of `names` imported by name under any local name, or `<ns>.<name>` of a namespace import of `from`. The answer is `'yes'` when a part is listed; else `'unknown'` when a part is a call whose callee is not a member (a factory), a binding it cannot follow, a computed member, an object literal's getter, setter or method, or a literal binding that is not held (Held); else `'no'`. An import from a package `names` does not list is `'no'`: a package's schemas are its own (k.privacy E1111)."
// Spec: k.privacy-reads, Conformance "With `modules/a/q.schema.ts` holding `export const shape = { q: s.string() }` and `export const Search = s.object(shape)`, and a route of `modules/a/a.contract.ts` whose `search` is the imported `Search`, each of these makes that `search` one E1111 with message `route search not readable statically; cannot show it holds no .pii()`: in `q.schema.ts`, `const r = shape; r.x = s.secret(s.string())`, `const { assign } = Object; assign(shape, { x: s.secret(s.string()) })`, `function f(o) { o.x = 1 } f(shape)` or `shape.x = s.secret(s.string())` inside a function body; in another project file, `import { shape } from './q.schema.ts'` then `shape.x = s.secret(s.string())`, or `import * as n from './q.schema.ts'` then `use(n)`. With none of them, it is clean, also with `Search` bound to `s.object({ ...shape })` or `s.object(shape).optional()` and with `typeof shape` in another file."
// Spec: k.privacy-reads, Conformance "A route `search` imported from a `*.schema.ts` file that binds it by `export let Search = s.object({ q: s.string() })` is one E1111 with message `route search not readable statically; cannot show it holds no .pii()`."
// Seed 1337 (the properties below). The type pass is off: the rule reads syntax, and several fixtures change objects the type system would refuse.
// Reading: "a route's `search` is one E1111" is `check` reporting E1111 once with the message `route search not readable statically; cannot show it holds no .pii()`.
// Reading: a reference "in another project file" is a file of the project given to `check`; a file the project does not hold is not read (Held's last sentence).
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { file } from "./boundary-support.ts";
import { reader, run as probeRun } from "./privacy-reads-probe.ts";
import { type Files, SEED } from "./support.ts";

const MSG = "route search not readable statically; cannot show it holds no .pii()";
const MANIFEST = file(
  "modules/a/module.ts",
  "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
);
const CONTRACT = file(
  "modules/a/a.contract.ts",
  "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nimport { Search } from './q.schema.ts'\nexport const a = contract('a', { 'a.show': { path: '/a', search: Search, output: s.object({}) } })\n",
);
const HEAD = "import { s } from '@keel/schema'\n";
const QSCHEMA = (tail = "", shape = "{ q: s.string() }", search = "s.object(shape)") =>
  file("modules/a/q.schema.ts", `${HEAD}export const shape = ${shape}\nexport const Search = ${search}\n${tail}`);
const e1111 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1111");
const project = (q: Files[number], ...more: Files): Files => [MANIFEST, q, CONTRACT, ...more];
const SECRET = "s.secret(s.string())";
const OTHER = (body: string, imp = "import { shape } from './q.schema.ts'\n") =>
  file("modules/a/other.ts", `${HEAD}${imp}${body}\n`);

describe("k.privacy-reads Held: a literal binding is followed only while every reference to it is one the read takes", () => {
  test("with `modules/a/q.schema.ts` holding `export const shape = { q: s.string() }` and `export const Search = s.object(shape)`, and a route whose `search` is the imported `Search`, none of the changes makes it unreadable, so it is clean, also with `Search` bound to `s.object({ ...shape })` or `s.object(shape).optional()` and with `typeof shape` in another file", () => {
    expect(e1111(project(QSCHEMA()))).toEqual([]);
    expect(e1111(project(QSCHEMA("", "{ q: s.string() }", "s.object({ ...shape })")))).toEqual([]);
    expect(e1111(project(QSCHEMA("", "{ q: s.string() }", "s.object(shape).optional()")))).toEqual([]);
    expect(e1111(project(QSCHEMA(), OTHER("export type T = typeof shape")))).toEqual([]);
  });

  test("in `q.schema.ts`, `const r = shape; r.x = s.secret(s.string())`, `const { assign } = Object; assign(shape, { x: s.secret(s.string()) })`, `function f(o) { o.x = 1 } f(shape)` or `shape.x = s.secret(s.string())` inside a function body each make that `search` one E1111 with message `route search not readable statically; cannot show it holds no .pii()`", () => {
    const tails = [
      `const r = shape\nr.x = ${SECRET}\n`,
      `const { assign } = Object\nassign(shape, { x: ${SECRET} })\n`,
      "function f(o: { x?: unknown }) { o.x = 1 }\nf(shape)\n",
      `export function g() { shape.x = ${SECRET} }\n`,
    ];
    for (const tail of tails) {
      const ds = e1111(project(QSCHEMA(tail)));
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(MSG);
    }
  });

  test("in another project file, `import { shape } from './q.schema.ts'` then `shape.x = s.secret(s.string())`, or `import * as n from './q.schema.ts'` then `use(n)`, makes that `search` one E1111", () => {
    const named = OTHER(`shape.x = ${SECRET}`);
    const ns = OTHER("declare const use: (x: unknown) => void\nuse(n)", "import * as n from './q.schema.ts'\n");
    for (const other of [named, ns]) {
      const ds = e1111(project(QSCHEMA(), other));
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(MSG);
    }
  });

  test("property: every other reference that is not one the read takes (an assignment target or its root, `delete`, `++`, a destructuring source, any other call's argument or receiver, a value returned, thrown or stored) leaves `shape` not held, in its own file, in another by name or alias, through a re-export, or through a namespace member", () => {
    const change = fc.constantFrom(
      (v: string) => `${v}.x = ${SECRET}`,
      (v: string) => `${v}['x'] = ${SECRET}`,
      (v: string) => `${v}.q.y = 1`,
      (v: string) => `delete ${v}.q`,
      (v: string) => `${v}.n++`,
      (v: string) => `${v}.n += 1`,
      (v: string) => `Object.assign(${v}, { x: ${SECRET} })`,
      (v: string) => `Object.defineProperty(${v}, 'x', { value: ${SECRET} })`,
      (v: string) => `Reflect.set(${v}, 'x', ${SECRET})`,
      (v: string) => `Object.setPrototypeOf(${v}, null)`,
      (v: string) => `JSON.stringify(${v})`,
      (v: string) => `structuredClone(${v})`,
      (v: string) => `${v}.toString()`,
      (v: string) => `const { q: copy } = ${v}`,
      (v: string) => `const { ...rest } = ${v}`,
      (v: string) => `export const out = () => ${v}`,
      (v: string) => `export const thrown = () => { throw ${v} }`,
      (v: string) => `export const stored = { a: [${v}].map((e) => e) }`,
      (v: string) => `let holder: unknown\nholder = ${v}`,
    );
    const where = fc.constantFrom("same", "named", "alias", "reexport", "namespace");
    fc.assert(
      fc.property(change, where, (write, place) => {
        const statement = (v: string) => write(v);
        let files: Files;
        if (place === "same") files = project(QSCHEMA(`${statement("shape")}\n`));
        else if (place === "named") files = project(QSCHEMA(), OTHER(statement("shape")));
        else if (place === "alias")
          files = project(QSCHEMA(), OTHER(statement("sh"), "import { shape as sh } from './q.schema.ts'\n"));
        else if (place === "reexport")
          files = project(
            QSCHEMA(),
            file("modules/a/index.ts", "export { shape as viaIndex } from './q.schema.ts'\n"),
            OTHER(statement("viaIndex"), "import { viaIndex } from './index.ts'\n"),
          );
        else files = project(QSCHEMA(), OTHER(statement("n.shape"), "import * as n from './q.schema.ts'\n"));
        const ds = e1111(files);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(MSG);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  test("property: a reference the read takes (a field value, a spread, an array element, a `?:` branch, an argument of `s.<name>(…)`, a member read in those places, an `export`, a held alias, a type) leaves `shape` held, in any of them and in another file", () => {
    const use = fc.constantFrom(
      "export const A = s.object({ f: shape.q })",
      "export const A = s.object({ ...shape })",
      "export const A = s.array(shape.q)",
      "export const A = s.union([shape.q, s.string()])",
      "export const A = s.object(shape)",
      "export const A = true ? s.object(shape) : s.string()",
      "const alias = shape\nexport const A = s.object(alias)",
      "export { shape as again }",
      "export type T = typeof shape",
    );
    const where = fc.constantFrom("same", "other");
    fc.assert(
      fc.property(use, where, (statement, place) => {
        const files = place === "same" ? project(QSCHEMA(`${statement}\n`)) : project(QSCHEMA(), OTHER(statement));
        expect(e1111(files)).toEqual([]);
      }),
      { seed: SEED, numRuns: 36 },
    );
  });

  test("the walk is by lexical scope: a parameter, a local or another file's own `shape` that is written to is not a reference to the binding", () => {
    const shadowed = [
      "export function f(shape: { x?: number }) { shape.x = 1 }",
      "export function g() { const shape = { x: 1 }; shape.x = 2 }",
      "export const h = (shape: { x?: number }) => { delete shape.x }",
      "{ const shape = { x: 1 }; shape.x = 2 }",
    ];
    for (const tail of shadowed) {
      expect(e1111(project(QSCHEMA(`${tail}\n`)))).toEqual([]);
      expect(e1111(project(QSCHEMA(), file("modules/a/other.ts", `${tail}\n`)))).toEqual([]);
    }
    expect(
      e1111(project(QSCHEMA(), file("modules/a/other.ts", "const shape = { q: 1 }\nshape.q = 2\nexport { shape }\n"))),
    ).toEqual([]);
  });

  test("a change to the binding in its own file makes it not held wherever the change sits, before the schema is made as after", () => {
    const before = file(
      "modules/a/q.schema.ts",
      `${HEAD}export const shape = { q: s.string() }\nshape.x = ${SECRET}\nexport const Search = s.object(shape)\n`,
    );
    const ds = e1111(project(before));
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(MSG);
  });

  test("a schema `@keel/schema` makes needs no such rule: passed to any call, changed through its `node`, stored or mutated in any file, `search` stays readable", () => {
    const calls = [
      "declare const use: (x: unknown) => void\nuse(Search)",
      "Object.assign(Search, { x: 1 })",
      "(Search as unknown as { node: { fields: Record<string, unknown> } }).node.fields.x = 1",
      "export const kept = [Search]",
      "JSON.stringify(Search)",
    ];
    for (const body of calls) {
      const other = file("modules/a/other.ts", `${HEAD}import { Search } from './q.schema.ts'\n${body}\n`);
      expect(e1111(project(QSCHEMA(), other))).toEqual([]);
    }
    const inFile = QSCHEMA("Object.assign(Search, { y: 1 })\n");
    expect(e1111(project(inFile))).toEqual([]);
  });

  test("a route `search` imported from a `*.schema.ts` file that binds it by `export let Search = s.object({ q: s.string() })` is one E1111 with message `route search not readable statically; cannot show it holds no .pii()`", () => {
    const q = file("modules/a/q.schema.ts", `${HEAD}export let Search = s.object({ q: s.string() })\n`);
    const ds = e1111(project(q));
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(MSG);
  });

  test("property: only a top-level `const` is followed: `let` and `var` bindings (exported) of a schema or a shape leave `search` unreadable", () => {
    fc.assert(
      fc.property(fc.constantFrom("let", "var"), fc.constantFrom("schema", "shape"), (kw, which) => {
        const q =
          which === "schema"
            ? file("modules/a/q.schema.ts", `${HEAD}export ${kw} Search = s.object({ q: s.string() })\n`)
            : file(
                "modules/a/q.schema.ts",
                `${HEAD}${kw} shape = { q: s.string() }\nexport const Search = s.object(shape)\n`,
              );
        const ds = e1111(project(q));
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(MSG);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});

describe("k.privacy-reads Readers: schemaHolds is 'unknown' for a literal binding that is not held", () => {
  const NAMES = [{ from: "@keel/std-tokens", name: "Digested" }];
  const PATH = "modules/a/x.ts";
  const answer = (lines: string[], extra: Files = []): unknown => {
    const holds = reader("schemaHolds");
    const source = `import { s } from "@keel/schema"\nimport { Digested } from "@keel/std-tokens"\n${lines.join("\n")}\n`;
    return probeRun([{ path: PATH, source }, ...extra], PATH, (input, nodes) =>
      nodes.map((n) => holds(n, input, NAMES)),
    );
  };

  test("`schemaHolds` is 'unknown' for `s.object(shape)` once `shape`, a literal binding, is written through an alias, passed to a call or assigned to, and 'no' while it is held", () => {
    const held = ["const shape = { d: s.string() }", "probe(s.object(shape))"];
    expect(answer(held)).toEqual(["no"]);
    const changes = [
      "const r = shape\nr.d = Digested",
      "shape.d = Digested",
      "Object.assign(shape, { d: Digested })",
      "declare const f: (o: unknown) => void\nf(shape)",
      "delete shape.d",
    ];
    fc.assert(
      fc.property(fc.constantFrom(...changes), (change) => {
        expect(answer(["const shape = { d: s.string() }", change, "probe(s.object(shape))"])).toEqual(["unknown"]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("`schemaHolds` is 'unknown' for a binding another checked file writes to, and 'yes' still when a listed part is in a held literal", () => {
    const shapeFile: Files = [{ path: "modules/a/shape.ts", source: "export const shape = { d: 1 }\n" }];
    const writer: Files = [
      ...shapeFile,
      { path: "modules/a/w.ts", source: "import { shape } from './shape.ts'\nshape.d = 2\n" },
    ];
    expect(answer(['import { shape } from "./shape.ts"', "probe(s.object(shape))"], writer)).toEqual(["unknown"]);
    expect(answer(['import { shape } from "./shape.ts"', "probe(s.object(shape))"], shapeFile)).toEqual(["no"]);
    expect(answer(["const shape = { d: Digested }", "probe(s.object(shape))"])).toEqual(["yes"]);
  });
});
