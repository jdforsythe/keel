// Spec: k.check, App code "The rules "in app code" read a project's code files (`.d.ts` aside) that are not test code (`*.test.*`, `*.spec.*`, or under `test/`, `tests/`, `conformance/` or `__tests__/`), not `*.config.*` and not under `.keel/` or `node_modules/`. A file under `unsafe/` is app code but for its lifted ranges. A lifted range is the arrow function or function expression written as the second argument of an `unsafe(` call (callee the identifier `unsafe`) whose first argument is a justification string, a string literal or a template without substitutions holding a non-space character, in a file under `unsafe/`: the function from its first character to its last, parameters, return type, comments and nested functions included. A second argument of another form (a name, a call), a call without a justification string (E1754) and a call in a file outside `unsafe/` give no range. Inside a lifted range E1252, E1451, E1452, E1601, E1603, E1651, E1757, E1758 and E1759 are not reported; every other code reads the range as it reads the rest of the file. Outside its lifted ranges an `unsafe/` file's imports, type declarations, signatures and helpers are checked as `modules/<id>/a.ts` is. A cast, `!` or suppression is written inside the function; a type that holds `any` is declared there too (`() => { type L = Chart<any>; return c as L }`), and a signature takes `unknown` or a type parameter. A stdlib rule that reads app code reads an `unsafe/` file whole: `unsafe` lifts the kernel codes above only."
// Spec: k.check, Rules "E1757 cast, non-null assertion, `any`, or ts-suppression in a code file outside `.keel/`, `node_modules/` and lifted ranges (App code); outside `unsafe/` the message ends `outside unsafe/; use a guard or move it to unsafe/`, in an `unsafe/` file `outside an unsafe() call; use a guard or move it into the call`"
// Spec: k.check, Conformance "In `modules/m/unsafe/a.ts`, `c as T`, `c!` and a TypeScript expect-error directive inside the arrow function given as the second argument of `unsafe('r', () => ...)`, and `any` as that function's return type, are no E1757; each of the four in a function declared at the file's top level is one E1757, the cast's message `type cast outside an unsafe() call; use a guard or move it into the call`."
// Spec: k.check, Conformance "In `modules/m/unsafe/a.ts`, `type L = any` and the parameter type of `export function f(v: any) {}`, both at the top level, are one E1757 each, and the same `type L = any` declared inside the arrow function given to `unsafe('r', () => ...)` is none."
// Spec: k.check, Conformance "In a project with no `topology.ts`, `Date.now()` (E1601), `document.title` (E1252), `eval(s)` (E1603), `throw e` (E1451), `try { f() } catch { g() }` (E1452), `ctx.net.fetch(r)` (E1651), `n.toLocaleString()` (E1758) and `Buffer.from(s)` (E1759) are each no diagnostic inside the arrow function given to `unsafe('r', () => ...)` in `modules/m/unsafe/a.ts`, and each one diagnostic of its code in a function declared at that file's top level."
// Spec: k.check, Conformance "In `modules/m/unsafe/a.ts`, `c as T` stays one E1757 when the arrow function holding it is the second argument of `unsafe('', ...)` (also one E1754), of `unsafe(reason, ...)` with `reason` a parameter (also one E1754), or is `const g = () => c as T` at the top level with `unsafe('r', g)` beside it."
// Spec: k.check, Conformance "`unsafe('r', () => c as T)` in `modules/m/a.ts` is one E1757 at the cast, its message `type cast outside unsafe/; use a guard or move it to unsafe/`."
// Spec: k.check, Conformance "In `modules/m/unsafe/a.ts`, a second top-level export is one E1752, and `scope(fn, { detached: true })` inside the arrow function given to `unsafe('r', () => ...)` is one E1207."
// Spec: k.check, Conformance "A rule registered with `defineRule` that reports every call expression reports the calls inside the arrow function given to `unsafe('r', () => ...)` in `modules/m/unsafe/a.ts`."
// Seed 1337 (every property below). Fixtures are source text over in-memory file maps; the `unsafe` call is built from
// a constant so this file's own source holds no literal call, only fixture text does.
import { check, defineRule } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, findAll } from "./support.ts";

const U = "unsafe";
/** `unsafe(reason, fn)`, both given as source text. */
const call = (reason: string, fn: string): string => `${U}(${reason}, ${fn})`;
const HELPER = `function ${U}<T>(reason: string, fn: () => T): T { return fn() }\n`;
const PATH = "modules/m/unsafe/a.ts";
const MANIFEST = {
  path: "modules/m/module.ts",
  source: `import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: [], capabilities: [], public: { exports: [] } })\n`,
};
const NEW_MSG = "outside an unsafe() call; use a guard or move it into the call";
const OLD_MSG = "outside unsafe/; use a guard or move it to unsafe/";

const diags = (source: string, path = PATH) => check([{ path, source }], { types: false }).diagnostics;
const withManifest = (files: Files) => check([MANIFEST, ...files], { types: false }).diagnostics;
const of = (ds: ReturnType<typeof diags>, code: string) => ds.filter((d) => d.code === code);

const reason = fc.stringMatching(/^[a-z][a-z ]{2,20}$/);
const ident = fc
  .stringMatching(/^[a-z]{3,8}$/)
  .filter((n) => !["declare", "function", "const", "export", "type"].includes(n));

const DECLS = `declare const c: unknown
declare const s: string
declare const e: unknown
declare const n: number
declare const r: string
declare const x: string
declare const ctx: unknown
declare function f(): void
declare function g(): void
declare function id<T>(v: T): T
declare const lib: { unsafe<T>(r: string, fn: () => T): T }
type T = number
`;
const HEAD = `${DECLS}${HELPER}`;

/** The nine lifted codes, each with one statement that reports it, in a project with no `topology.ts`. */
const LIFTED: readonly (readonly [string, string])[] = [
  ["E1252", "document.title"],
  ["E1451", "throw e"],
  ["E1452", "try { f() } catch { g() }"],
  ["E1601", "Date.now()"],
  ["E1603", "eval(s)"],
  ["E1651", "ctx.net.fetch(r)"],
  ["E1757", "c as T"],
  ["E1758", "n.toLocaleString()"],
  ["E1759", "Buffer.from(s)"],
];
const EIGHT = LIFTED.filter(([code]) => code !== "E1757");

const outsideSrc = (stmt: string, fn: string, why: string) =>
  `${HEAD}function ${fn}() { ${stmt} }\nexport const a = ${call(`'${why}'`, "() => 1")}\n`;
const insideSrc = (stmt: string, why: string) => `${HEAD}export const a = ${call(`'${why}'`, `() => { ${stmt} }`)}\n`;

// ---- Rules: E1757 ----

test("E1757: a cast, non-null assertion, `any` or ts-suppression in a code file outside `.keel/`, `node_modules/` and lifted ranges is reported; in `.keel/` and `node_modules/` it is not", () => {
  const src = `declare const c: unknown\nexport const a = c as number\n`;
  expect(of(diags(src, "modules/m/a.ts"), "E1757")).toHaveLength(1);
  expect(of(diags(src, "modules/m/.keel/a.ts"), "E1757")).toHaveLength(0);
  expect(of(diags(src, "node_modules/p/a.ts"), "E1757")).toHaveLength(0);
});

test("E1757: outside `unsafe/` the message ends `outside unsafe/; use a guard or move it to unsafe/`, in an `unsafe/` file `outside an unsafe() call; use a guard or move it into the call`, for each of the four kinds", () => {
  const SUPPRESS = `@ts-${"expect-error"}`;
  const kinds = [
    `declare const c: unknown\nexport function a() { return c as number }\n`,
    `declare const c: number | undefined\nexport function a() { return c! }\n`,
    `export function a(): any { return 1 }\n`,
    `export function a() {\n  // ${SUPPRESS}\n  const v: number = 'x'\n  return v\n}\n`,
  ];
  for (const src of kinds) {
    const outside = of(diags(src, "modules/m/a.ts"), "E1757");
    expect(outside).toHaveLength(1);
    expect(outside[0]?.message.endsWith(OLD_MSG)).toBe(true);
    const inside = of(diags(src, PATH), "E1757");
    expect(inside).toHaveLength(1);
    expect(inside[0]?.message.endsWith(NEW_MSG)).toBe(true);
    expect(inside[0]?.message.length).toBeLessThan(90);
  }
});

// ---- App code: a file under unsafe/ is app code but for its lifted ranges ----

test("App code: a file under `unsafe/` with no `unsafe(` call reports what the same source reports at `modules/m/a.ts` (the codes agree, for any generated statement)", () => {
  fc.assert(
    fc.property(fc.constantFrom(...LIFTED), ident, ([, stmt], fn) => {
      const src = `${DECLS}export function a() { ${stmt}; return '${fn}' }\n`;
      const here = diags(src, PATH)
        .map((d) => d.code)
        .sort();
      const there = diags(src, "modules/m/a.ts")
        .map((d) => d.code)
        .sort();
      expect(here).toEqual(there);
      expect(here.length).toBeGreaterThan(0);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("App code: outside its lifted ranges an `unsafe/` file's imports, type declarations, signatures and helpers are checked as `modules/<id>/a.ts` is (a second export is E1752 in both)", () => {
  const src = `import { s } from '@keel/schema'\nexport interface Row { id: string }\nexport type Id = string\nexport const b = 1\nexport const a = ${call("'r'", "() => 1")}\n${HELPER}`;
  const here = of(diags(src, PATH), "E1752");
  const there = of(diags(src, "modules/m/a.ts"), "E1752");
  expect(here.length).toBeGreaterThan(0);
  expect(here.length).toBe(there.length);
});

test("App code: the lifted range is the arrow function or function expression, parameters, return type, comments and nested functions included", () => {
  const forms = [
    `() => c as T`,
    `function () { return c as T }`,
    `() => { const n = () => c as T; return n }`,
    `(v: unknown = c as T) => v`,
    `(): T => { /* a note */ return c as T }`,
  ];
  for (const fn of forms) {
    const src = `${HEAD}export const a = ${call("'r'", fn)}\n`;
    expect(of(diags(src), "E1757")).toHaveLength(0);
  }
});

test("App code: a justification string is a string literal or a template without substitutions holding a non-space character", () => {
  fc.assert(
    fc.property(reason, (why) => {
      for (const lit of [`'${why}'`, `"${why}"`, `\`${why}\``]) {
        const ds = diags(`${HEAD}export const a = ${call(lit, "() => c as T")}\n`);
        expect(of(ds, "E1757")).toHaveLength(0);
        expect(of(ds, "E1754")).toHaveLength(0);
      }
    }),
    { seed: SEED, numRuns: 30 },
  );
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 6 }), (k) => {
      const blank = " ".repeat(k);
      for (const lit of [`'${blank}'`, `\`${blank}\``, "`${x}`", "`a${x}`"]) {
        const ds = diags(`${HEAD}export const a = ${call(lit, "() => c as T")}\n`);
        expect(of(ds, "E1757")).toHaveLength(1);
        expect(of(ds, "E1754")).toHaveLength(1);
      }
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("App code: a second argument of another form (a name, a call), and a callee that is not the identifier `unsafe`, give no range", () => {
  const cases = [
    `${HEAD}const h = () => c as T\nexport const a = ${call("'r'", "h")}\n`,
    `${HEAD}export const a = ${call("'r'", "id(() => c as T)")}\n`,
    `${HEAD}export const a = lib.${U}('r', () => c as T)\n`,
    `${HEAD}export const a = id('r', () => c as T)\n`,
  ];
  for (const src of cases) expect(of(diags(src), "E1757")).toHaveLength(1);
});

// Untestable here: "A stdlib rule that reads app code reads an `unsafe/` file whole" is asserted in @keel/std-messages (E2406), since kernel packages never import std packages; the registered-rule case below covers the pipeline half.

// ---- Conformance bullets ----

test("In `modules/m/unsafe/a.ts`, `c as T`, `c!` and a TypeScript expect-error directive inside the arrow function given as the second argument of `unsafe('r', () => ...)`, and `any` as that function's return type, are no E1757; each of the four in a function declared at the file's top level is one E1757, the cast's message `type cast outside an unsafe() call; use a guard or move it into the call`.", () => {
  const SUPPRESS = `@ts-${"expect-error"}`;
  fc.assert(
    fc.property(reason, (why) => {
      const r = `'${why}'`;
      const bodies = [
        `() => c as T`,
        `() => c!`,
        `() => {\n  // ${SUPPRESS}\n  const v: number = 'x'\n  return v\n}`,
        `(): any => 1`,
      ];
      for (const fn of bodies) {
        expect(of(diags(`${HEAD}export const a = ${call(r, fn)}\n`), "E1757")).toHaveLength(0);
      }
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("each of the four in a function declared at the file's top level is one E1757, the cast's message `type cast outside an unsafe() call; use a guard or move it into the call`", () => {
  const SUPPRESS = `@ts-${"expect-error"}`;
  const cast = of(diags(`${HEAD}export function a() { return c as T }\n`), "E1757");
  expect(cast).toHaveLength(1);
  expect(cast[0]?.message).toBe(`type cast ${NEW_MSG}`);
  for (const body of [
    `export function a() { return c as T }`,
    `declare const q: number | undefined\nexport function a() { return q! }`,
    `export function a(): any { return 1 }`,
    `export function a() {\n  // ${SUPPRESS}\n  const v: number = 'x'\n  return v\n}`,
  ]) {
    expect(of(diags(`${HEAD}${body}\n`), "E1757")).toHaveLength(1);
  }
});

test("In `modules/m/unsafe/a.ts`, `type L = any` and the parameter type of `export function f(v: any) {}`, both at the top level, are one E1757 each, and the same `type L = any` declared inside the arrow function given to `unsafe('r', () => ...)` is none", () => {
  fc.assert(
    fc.property(ident, reason, (name, why) => {
      const alias = of(diags(`${HELPER}type ${name} = any\nexport const a = 1\n`), "E1757");
      expect(alias).toHaveLength(1);
      const param = of(diags(`export function f(v: any) {}\n`, "modules/m/unsafe/f.ts"), "E1757");
      expect(param).toHaveLength(1);
      const inside = `${HELPER}export const a = ${call(`'${why}'`, `() => { type ${name} = any; return 1 }`)}\n`;
      expect(of(diags(inside), "E1757")).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("In a project with no `topology.ts`, `Date.now()` (E1601), `document.title` (E1252), `eval(s)` (E1603), `throw e` (E1451), `try { f() } catch { g() }` (E1452), `ctx.net.fetch(r)` (E1651), `n.toLocaleString()` (E1758) and `Buffer.from(s)` (E1759) are each no diagnostic inside the arrow function given to `unsafe('r', () => ...)`, and each one diagnostic of its code in a function declared at that file's top level", () => {
  for (const [code, stmt] of EIGHT) {
    expect(of(diags(`${HEAD}export const a = ${call("'r'", `() => { ${stmt} }`)}\n`), code)).toHaveLength(0);
    expect(of(diags(`${HEAD}export function a() { ${stmt} }\n`), code)).toHaveLength(1);
  }
});

test("property: each of the nine lifted codes is reported for a statement outside a range and not for the same statement inside one, in an `unsafe/` file", () => {
  fc.assert(
    fc.property(fc.constantFrom(...LIFTED), ident, reason, ([code, stmt], fn, why) => {
      expect(of(diags(outsideSrc(stmt, fn, why)), code)).toHaveLength(1);
      expect(of(diags(insideSrc(stmt, why)), code)).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 60 },
  );
});

test("In `modules/m/unsafe/a.ts`, `c as T` stays one E1757 when the arrow function holding it is the second argument of `unsafe('', ...)` (also one E1754), of `unsafe(reason, ...)` with `reason` a parameter (also one E1754), or is `const g = () => c as T` at the top level with `unsafe('r', g)` beside it", () => {
  const empty = diags(`${HEAD}export const a = ${call("''", "() => c as T")}\n`);
  expect(of(empty, "E1757")).toHaveLength(1);
  expect(of(empty, "E1754")).toHaveLength(1);
  const param = diags(`${HEAD}export function a(reason: string) { return ${call("reason", "() => c as T")} }\n`);
  expect(of(param, "E1757")).toHaveLength(1);
  expect(of(param, "E1754")).toHaveLength(1);
  const named = diags(`${HEAD}const g = () => c as T\nexport const a = ${call("'r'", "g")}\n`);
  expect(of(named, "E1757")).toHaveLength(1);
});

test("`unsafe('r', () => c as T)` in `modules/m/a.ts` is one E1757 at the cast, its message `type cast outside unsafe/; use a guard or move it to unsafe/`", () => {
  fc.assert(
    fc.property(ident, reason, (name, why) => {
      const src = `${DECLS}${HELPER}export const ${name} = ${call(`'${why}'`, "() => c as T")}\n`;
      const d = of(diags(src, `modules/m/${name}.ts`), "E1757");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(`type cast ${OLD_MSG}`);
      expect(d[0]?.line).toBe(src.split("\n").findIndex((l) => l.includes(`export const ${name}`)) + 1);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

// Other app-code codes read a range as they read the rest of the file.
const NOT_LIFTED: readonly (readonly [string, string, (why: string) => string])[] = [
  [
    "E1207",
    "modules/m/unsafe/a.ts",
    (why) =>
      `import { scope } from '@keel/reactive'\n${HELPER}export const a = ${call(`'${why}'`, "() => scope(() => {}, { detached: true })")}\n`,
  ],
  [
    "E1551",
    "modules/m/unsafe/a.ts",
    (why) =>
      `import { commitStores } from '@keel/server'\ndeclare const ctx: never\ndeclare const factory: never\n${HELPER}export const a = ${call(`'${why}'`, "() => commitStores(ctx, factory, () => undefined)")}\n`,
  ],
  [
    "E1112",
    "modules/m/unsafe/x.server.ts",
    (why) =>
      `import { reveal } from '@keel/schema'\nimport { tx } from '@keel/store'\ndeclare const t: {}\ndeclare const p: { k: string }\n${HELPER}export const x = ${call(`'${why}'`, "() => tx(t, { v: reveal(p.k) })")}\n`,
  ],
  [
    "E1003",
    "modules/m/unsafe/a.tsx",
    (why) =>
      `import { Image } from '@keel/ui'\n${HELPER}export const a = ${call(`'${why}'`, `() => <Image src="javascript:alert(1)" alt="x" />`)}\n`,
  ],
  [
    "E1404",
    "modules/m/unsafe/a.tsx",
    (why) =>
      `import { Box } from '@keel/ui'\n${HELPER}export const a = ${call(`'${why}'`, `() => <Box as="section"><Box id="x">1</Box><Box id="x">2</Box></Box>`)}\n`,
  ],
];

test("property: for each of a sample of other app-code codes (E1207, E1551, E1112, E1003, E1404), the violation is reported inside a range too", () => {
  fc.assert(
    fc.property(fc.constantFrom(...NOT_LIFTED), reason, ([code, path, build], why) => {
      expect(of(withManifest([{ path, source: build(why) }]), code).length).toBeGreaterThanOrEqual(1);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("In `modules/m/unsafe/a.ts`, a second top-level export is one E1752, and `scope(fn, { detached: true })` inside the arrow function given to `unsafe('r', () => ...)` is one E1207", () => {
  const two = withManifest([
    { path: PATH, source: `${HELPER}export const a = ${call("'r'", "() => 1")}\nexport const b = 1\n` },
  ]);
  expect(of(two, "E1752")).toHaveLength(1);
  const detached = withManifest([
    {
      path: PATH,
      source: `import { scope } from '@keel/reactive'\n${HELPER}export const a = ${call("'r'", "() => scope(() => {}, { detached: true })")}\n`,
    },
  ]);
  expect(of(detached, "E1207")).toHaveLength(1);
});

defineRule({
  code: "E2961",
  message: "a call",
  see: "k.check",
  explain: "Every call is reported.",
  check: ({ file }) => findAll(file, "probe("),
});

test("A rule registered with `defineRule` that reports every call expression reports the calls inside the arrow function given to `unsafe('r', () => ...)` in `modules/m/unsafe/a.ts`", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 }), (outer, inner) => {
      const top = Array.from({ length: outer }, (_, i) => `probe(${i})`).join("\n");
      const body = Array.from({ length: inner }, (_, i) => `probe(${i})`).join("; ");
      const src = `declare const probe: (n: number) => number\n${HELPER}${top}\nexport const a = ${call("'r'", `() => { ${body} }`)}\n`;
      const hits = of(diags(src), "E2961");
      expect(hits).toHaveLength(outer + inner);
      const lines = hits.map((d) => d.line);
      const bodyLine = src.split("\n").findIndex((l) => l.startsWith("export const a")) + 1;
      expect(lines.filter((l) => l === bodyLine)).toHaveLength(inner);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

// ---- Placement ----

type Slot = { kind: string; inside: boolean; line: (i: number, s: string) => string };
const SLOTS: readonly Slot[] = [
  { kind: "top-level function", inside: false, line: (i, s) => `function h${i}() { ${s} }` },
  {
    kind: "function nested in a top-level function",
    inside: false,
    line: (i, s) => `function o${i}() { const n = () => { ${s} }; return n }`,
  },
  { kind: "arrow second argument", inside: true, line: (i, s) => `const r${i} = ${call("'r'", `() => { ${s} }`)}` },
  {
    kind: "function expression second argument",
    inside: true,
    line: (i, s) => `const r${i} = ${call("'r'", `function () { ${s} }`)}`,
  },
  {
    kind: "function nested in the range",
    inside: true,
    line: (i, s) => `const r${i} = ${call("'r'", `() => { const n = () => { ${s} }; return n }`)}`,
  },
  { kind: "template reason", inside: true, line: (i, s) => `const r${i} = ${call("`why`", `() => { ${s} }`)}` },
  {
    kind: "named second argument",
    inside: false,
    line: (i, s) => `function g${i}() { ${s} }; const r${i} = ${call("'r'", `g${i}`)}`,
  },
  { kind: "empty reason", inside: false, line: (i, s) => `const r${i} = ${call("''", `() => { ${s} }`)}` },
  {
    kind: "reason with a substitution",
    inside: false,
    line: (i, s) => `const r${i} = ${call("`${x}`", `() => { ${s} }`)}`,
  },
  {
    kind: "function wrapped in a call",
    inside: false,
    line: (i, s) => `const r${i} = ${call("'r'", `id(() => { ${s} })`)}`,
  },
  { kind: "member callee", inside: false, line: (i, s) => `const r${i} = lib.${U}('r', () => { ${s} })` },
];

test("property: for any generated placement of a violating statement relative to nested functions and several `unsafe(` calls in one file, it is lifted exactly when it lies inside the function given as the second argument of a valid call", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...LIFTED),
      fc.array(fc.constantFrom(...SLOTS), { minLength: 1, maxLength: 8 }),
      ([code, stmt], slots) => {
        const lines = slots.map((s, i) => s.line(i, stmt));
        const src = `${HEAD}${lines.join("\n")}\nexport const a = 1\n`;
        const headLines = HEAD.split("\n").length - 1;
        const expected = slots.flatMap((s, i) => (s.inside ? [] : [headLines + i + 1]));
        const got = of(diags(src), code).map((d) => d.line);
        expect([...new Set(got)].sort((p, q) => p - q)).toEqual(expected);
        expect(got.length).toBe(expected.length);
      },
    ),
    { seed: SEED, numRuns: 120 },
  );
});
