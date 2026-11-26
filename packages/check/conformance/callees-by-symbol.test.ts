// Spec: k.unsafe, clause "In `modules/m/a.ts`, each of `Promise.reject(e)`, `p.then(f, g)`, `p['catch'](g)`, `Promise.prototype.catch.call(p, g)`, `Promise.allSettled(ps)` and `Promise.any(ps)` is one diagnostic, E1451 for the first and E1452 for the rest; `const d2 = defect; d2('x', 'E12')` is one E1455 at `'E12'`; `const c = p.catch; c(g)` is one E1452 at `p.catch`, message `catch used other than as a call; check cannot follow it`; `p.then(f)` is none."
// k.unsafe, One path "`unsafe` is the one path around a check, so no spelling is another: E1451, E1452, E1455 (k.errors) and E1207 (k.reactive) find their callee by its symbol in the type pass, not its spelling: an alias, a namespace member, a computed member with a literal key (`p['catch']`), `.call`, `.apply` or `.bind` of it (`Promise.prototype.catch.call(p, g)`), and `Reflect.apply` of it are each that call. The function used as a value any other way (stored, passed, returned, under a non-literal computed key) is that code at the use, message `<name> used other than as a call; check cannot follow it`, no fix. Under `check(files, { types: false })` they read spellings only. For E1455 the code argument is, by form: the second argument of a call of `defect` or an alias; the third of `defect.call(t, m, c)`; the second element of the array literal of `defect.apply(t, [m, c])` and of `Reflect.apply(defect, t, [m, c])`. E1455 is reported at that argument or element; an arguments value that is no array literal or holds a spread before the code, and a `defect.bind(...)`, is one E1455 at that value or at `bind`, message `defect code check cannot read`."
// Seed 1337. Fixtures are source text over in-memory file maps with the type pass on (the default), so each import resolves; a code other than the four is not counted.
// Assumption: the `<name>` of a value use is the last member name (`reject`, `allSettled`, `any`, `catch`, `defect`, `scope`); only `catch`'s message is quoted whole, the others are read by their ending and name.
// Assumption: a `.then(f)` held as a value is not asserted: whether it is a catch depends on the arguments it is later given.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { manifestFile } from "./module-support.ts";
import { SEED } from "./support.ts";

const PATH = "modules/m/a.ts";
const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD = `import { defect } from '@keel/schema'
import { scope } from '@keel/reactive'
declare const e: unknown
declare const p: Promise<number>
declare const ps: Promise<number>[]
declare const f: () => void
declare const g: () => void
declare function use(fn: unknown): void
`;
const CODES = ["E1451", "E1452", "E1455", "E1207"];
const TAIL = "used other than as a call; check cannot follow it";

const run = (body: string, opts: { types: boolean } | undefined = undefined) =>
  check([MANIFEST, { path: PATH, source: `${HEAD}${body}\n` }], opts).diagnostics.filter((d) => CODES.includes(d.code));
const codes = (body: string, opts?: { types: boolean }) => run(body, opts).map((d) => d.code);
const at = (body: string, needle: string): { line: number; col: number } => {
  const source = `${HEAD}${body}\n`;
  const before = source.slice(0, source.indexOf(needle, HEAD.length)).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};

test("`Promise.reject(e)` is one E1451", () => {
  expect(codes("export const a = Promise.reject(e)")).toEqual(["E1451"]);
});

test("`p.then(f, g)`, `p['catch'](g)`, `Promise.prototype.catch.call(p, g)`, `Promise.allSettled(ps)` and `Promise.any(ps)` are one E1452 each", () => {
  for (const body of [
    "export const a = p.then(f, g)",
    "export const a = p['catch'](g)",
    "export const a = Promise.prototype.catch.call(p, g)",
    "export const a = Promise.allSettled(ps)",
    "export const a = Promise.any(ps)",
  ]) {
    expect(codes(body), body).toEqual(["E1452"]);
  }
});

test("`const d2 = defect; d2('x', 'E12')` is one E1455 at `'E12'`", () => {
  const body = "const d2 = defect\nexport const a = (): never => d2('x', 'E12')";
  const ds = run(body);
  expect(ds.map((d) => d.code)).toEqual(["E1455"]);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(body, "'E12'"));
});

test("`const c = p.catch; c(g)` is one E1452 at `p.catch`, message `catch used other than as a call; check cannot follow it`", () => {
  const body = "const c = p.catch\nexport const a = c(g)";
  const ds = run(body);
  expect(ds.map((d) => d.code)).toEqual(["E1452"]);
  expect(ds[0]?.message).toBe("catch used other than as a call; check cannot follow it");
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(body, "p.catch"));
});

test("`p.then(f)` is none", () => {
  expect(codes("export const a = p.then(f)")).toEqual([]);
  expect(codes("export const a = Promise.prototype.then.call(p, f)")).toEqual([]);
});

// Each callee, each way of naming it that the text lists: one diagnostic of its code.
type Callee = { name: string; code: string; forms: readonly string[] };
const CALLEES: readonly Callee[] = [
  {
    name: "Promise.reject",
    code: "E1451",
    forms: [
      "Promise.reject(e)",
      "Promise['reject'](e)",
      "Promise.reject.call(Promise, e)",
      "Promise.reject.apply(Promise, [e])",
      "Promise.reject.bind(Promise)(e)",
      "Reflect.apply(Promise.reject, Promise, [e])",
      "(() => { const P = Promise; return P.reject(e) })()",
    ],
  },
  {
    name: "p.catch",
    code: "E1452",
    forms: [
      "p.catch(g)",
      "p['catch'](g)",
      "p.catch.call(p, g)",
      "p.catch.apply(p, [g])",
      "p.catch.bind(p)(g)",
      "Reflect.apply(p.catch, p, [g])",
      "Promise.prototype.catch.call(p, g)",
    ],
  },
  {
    name: "p.then(f, g)",
    code: "E1452",
    forms: [
      "p.then(f, g)",
      "p['then'](f, g)",
      "p.then.call(p, f, g)",
      "Promise.prototype.then.apply(p, [f, g])",
      "Reflect.apply(Promise.prototype.then, p, [f, g])",
    ],
  },
  {
    name: "Promise.allSettled",
    code: "E1452",
    forms: [
      "Promise.allSettled(ps)",
      "Promise['allSettled'](ps)",
      "Promise.allSettled.call(Promise, ps)",
      "Reflect.apply(Promise.allSettled, Promise, [ps])",
      "(() => { const P = Promise; return P.allSettled(ps) })()",
    ],
  },
  {
    name: "Promise.any",
    code: "E1452",
    forms: [
      "Promise.any(ps)",
      "Promise['any'](ps)",
      "Promise.any.call(Promise, ps)",
      "Reflect.apply(Promise.any, Promise, [ps])",
    ],
  },
  {
    name: "defect",
    code: "E1455",
    forms: [
      "defect('x', 'E12')",
      "(() => { const d = defect; return d('x', 'E12') })()",
      "Reflect.apply(defect, undefined, ['x', 'E12'])",
      "defect.call(undefined, 'x', 'E12')",
    ],
  },
  {
    name: "scope",
    code: "E1207",
    forms: [
      "scope(() => undefined, { detached: true })",
      "(() => { const sc = scope; return sc(() => undefined, { detached: true }) })()",
      "Reflect.apply(scope, undefined, [() => undefined, { detached: true }])",
      "scope.call(undefined, () => undefined, { detached: true })",
    ],
  },
];

test("property: every way the text lists of naming a callee (alias, literal computed member, `.call`, `.apply`, `.bind`, `Reflect.apply`) is one diagnostic of that callee's code", () => {
  const cases = CALLEES.flatMap((c) => c.forms.map((form) => ({ code: c.code, form })));
  fc.assert(
    fc.property(fc.constantFrom(...cases), ({ code, form }) => {
      expect(codes(`export const a = ${form}`), form).toEqual([code]);
    }),
    { seed: SEED, numRuns: cases.length * 2 },
  );
});

// The function used as a value any other way is that code at the use, message `<name> used other than as a call; ...`.
const VALUES: readonly { name: string; ref: string; code: string }[] = [
  { name: "reject", ref: "Promise.reject", code: "E1451" },
  { name: "catch", ref: "p.catch", code: "E1452" },
  { name: "allSettled", ref: "Promise.allSettled", code: "E1452" },
  { name: "any", ref: "Promise.any", code: "E1452" },
  { name: "defect", ref: "defect", code: "E1455" },
  { name: "scope", ref: "scope", code: "E1207" },
];
const USES: readonly (readonly [string, (ref: string) => string])[] = [
  ["stored", (ref) => `const held = ${ref}\nexport const a = held`],
  ["passed", (ref) => `export const a = use(${ref})`],
  ["returned", (ref) => `export const a = () => ${ref}`],
];

test("property: the function stored, passed or returned as a value is that code at the use, message `<name> used other than as a call; check cannot follow it`, no fix", () => {
  fc.assert(
    fc.property(fc.constantFrom(...VALUES), fc.constantFrom(...USES), (v, [how, make]) => {
      const body = make(v.ref);
      const ds = run(body);
      expect(
        ds.map((d) => d.code),
        `${how} ${v.ref}`,
      ).toEqual([v.code]);
      expect(ds[0]?.message).toContain(v.name);
      expect(ds[0]?.message.endsWith(TAIL)).toBe(true);
      expect(ds[0]?.fix).toBeUndefined();
      expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(body, v.ref));
    }),
    { seed: SEED, numRuns: VALUES.length * USES.length * 2 },
  );
});

test("a callee that is none of the four, however it is named, is no diagnostic (`Promise.resolve`, `Promise.all`, `p.finally`, a local `reject`)", () => {
  for (const body of [
    "export const a = Promise.resolve(1)",
    "export const a = Promise.all(ps)",
    "export const a = p.finally(f)",
    "export const a = Promise['resolve'](1)",
    "const reject = (x: unknown) => x\nexport const a = reject(e)",
    "const o = { catch: (x: unknown) => x }\nexport const a = o.catch(g)",
    "const o = { defect: (x: string, c: string) => c }\nexport const a = o.defect('x', 'E12')",
  ]) {
    expect(codes(body), body).toEqual([]);
  }
});

test("under `check(files, { types: false })` they read spellings only: a direct call is found, an alias is not", () => {
  const off = { types: false };
  expect(codes("export const a = Promise.reject(e)", off)).toEqual(["E1451"]);
  expect(codes("export const a = p.then(f, g)", off)).toEqual(["E1452"]);
  expect(codes("export const a = Promise.allSettled(ps)", off)).toEqual(["E1452"]);
  expect(codes("const d2 = defect\nexport const a = (): never => d2('x', 'E12')", off)).toEqual([]);
  expect(codes("const c = p.catch\nexport const a = c(g)", off)).toEqual([]);
});
