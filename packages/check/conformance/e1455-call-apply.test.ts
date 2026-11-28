// Spec: k.unsafe, clause "In `modules/m/a.ts` importing `defect` from `@keel/schema`, `defect.call(null, 'x', { code: 'E12' })` is one E1455 at `'E12'`, `defect.apply(null, ['x', { code: 'E12' }])` and `Reflect.apply(defect, null, ['x', { code: 'E12' }])` one each at `'E12'`, `defect.apply(null, args)` one at `args` and `defect.bind(null)` one at `bind`, each message `defect code check cannot read` for the last two; `defect.call(null, 'x', { code: 'E2801' })` and `Reflect.apply(defect, null, ['x', { code: 'E2801' }])` are none."
// Seed 1337. Fixtures are source text over in-memory file maps with the type pass on (the default); only E1455 is read.
// Assumption: "at `bind`" is the first character of the member name `bind`, as E1455 is at a call's argument elsewhere (k.errors Rules).
// Spec: k.unsafe, One path: "an arguments value that is no array literal or holds a spread at or before the detail, a spread argument there in a call, and a `defect.bind(...)`, is one E1455 at that value or at `bind`, message `defect code check cannot read`."
// Spec: k.defects, Rules: "or whose second argument is not an object literal without a spread, or that has a third, a spread among them, at it (a spread in the second's place is unread, k.unsafe One path), message `defect detail is not an object literal`."
// A spread after the detail in an array (`['x', { code: 'E2801' }, ...rest]`) has no case: k.unsafe names a spread at or before the detail only.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { manifestFile } from "./module-support.ts";
import { SEED } from "./support.ts";

const PATH = "modules/m/a.ts";
const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD = `import { defect } from '@keel/schema'
declare const args: unknown[]
declare const rest: string[]
declare const ds: object[]
`;
const UNREADABLE = "defect code check cannot read";
const NOT_LITERAL = "defect code is not a literal E and four digits";

const run = (body: string) =>
  check([MANIFEST, { path: PATH, source: `${HEAD}${body}\n` }]).diagnostics.filter((d) => d.code === "E1455");
const at = (body: string, needle: string): { line: number; col: number } => {
  const source = `${HEAD}${body}\n`;
  const before = source.slice(0, source.indexOf(needle, HEAD.length)).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};
const pos = (d: { line: number; col: number } | undefined) => ({ line: d?.line, col: d?.col });

test("`defect.call(null, 'x', { code: 'E12' })` is one E1455 at `'E12'`", () => {
  const body = "export const a = defect.call(null, 'x', { code: 'E12' })";
  const ds = run(body);
  expect(ds).toHaveLength(1);
  expect(pos(ds[0])).toEqual(at(body, "'E12'"));
  expect(ds[0]?.message).toBe(NOT_LITERAL);
  expect(ds[0]?.fix).toBeUndefined();
});

test("`defect.apply(null, ['x', { code: 'E12' }])` is one E1455 at `'E12'`", () => {
  const body = "export const a = defect.apply(null, ['x', { code: 'E12' }])";
  const ds = run(body);
  expect(ds).toHaveLength(1);
  expect(pos(ds[0])).toEqual(at(body, "'E12'"));
});

test("`Reflect.apply(defect, null, ['x', { code: 'E12' }])` is one E1455 at `'E12'`", () => {
  const body = "export const a = Reflect.apply(defect, null, ['x', { code: 'E12' }])";
  const ds = run(body);
  expect(ds).toHaveLength(1);
  expect(pos(ds[0])).toEqual(at(body, "'E12'"));
});

test("`defect.apply(null, args)` is one E1455 at `args`, message `defect code check cannot read`", () => {
  const body = "export const a = defect.apply(null, args)";
  const ds = run(body);
  expect(ds).toHaveLength(1);
  expect(pos(ds[0])).toEqual(at(body, "args"));
  expect(ds[0]?.message).toBe(UNREADABLE);
});

test("`defect.bind(null)` is one E1455 at `bind`, message `defect code check cannot read`", () => {
  const body = "export const a = defect.bind(null)";
  const ds = run(body);
  expect(ds).toHaveLength(1);
  expect(pos(ds[0])).toEqual(at(body, "bind"));
  expect(ds[0]?.message).toBe(UNREADABLE);
});

test("`defect.call(null, 'x', { code: 'E2801' })` and `Reflect.apply(defect, null, ['x', { code: 'E2801' }])` are none", () => {
  expect(run("export const a = defect.call(null, 'x', { code: 'E2801' })")).toEqual([]);
  expect(run("export const a = Reflect.apply(defect, null, ['x', { code: 'E2801' }])")).toEqual([]);
  expect(run("export const a = defect.apply(null, ['x', { code: 'E2801' }])")).toEqual([]);
});

const bad = fc.oneof(
  fc.constantFrom("E12", "e2801", "E28011", "X2801", "", "E 2801"),
  fc.stringMatching(/^E[0-9]{1,3}$/),
  fc.stringMatching(/^E[0-9]{5,6}$/),
);
const good = fc.stringMatching(/^E[0-9]{4}$/);

test("property: the detail is the second argument of a direct call, the third of `defect.call`, the second array element of `.apply` and `Reflect.apply`: a bad `code` in it is one E1455 at exactly that value, a good one is none", () => {
  const forms: readonly ((c: string) => string)[] = [
    (c) => `defect('x', { code: '${c}' })`,
    (c) => `defect.call(null, 'x', { code: '${c}' })`,
    (c) => `defect.apply(null, ['x', { code: '${c}' }])`,
    (c) => `Reflect.apply(defect, null, ['x', { code: '${c}' }])`,
  ];
  fc.assert(
    fc.property(fc.constantFrom(...forms), bad, good, (form, b, g) => {
      const badBody = `export const a = ${form(b)}`;
      const ds = run(badBody);
      expect(ds).toHaveLength(1);
      expect(pos(ds[0])).toEqual(at(badBody, `'${b}'`));
      expect(ds[0]?.message).toBe(NOT_LITERAL);
      expect(run(`export const a = ${form(g)}`)).toEqual([]);
    }),
    { seed: SEED, numRuns: 80 },
  );
});

test("property: an arguments value that is no array literal, or an array holding a spread before the detail, and a `defect.bind(...)`, is one E1455 at that value or at `bind`, message `defect code check cannot read`", () => {
  const cases: readonly { body: string; needle: string }[] = [
    { body: "export const a = defect.apply(null, args)", needle: "args" },
    { body: "export const a = Reflect.apply(defect, null, args)", needle: "args" },
    { body: "export const a = defect.apply(null, [...rest, { code: 'E2801' }])", needle: "[...rest" },
    { body: "export const a = Reflect.apply(defect, null, [...rest, { code: 'E2801' }])", needle: "[...rest" },
    { body: "export const a = defect.bind(null)", needle: "bind" },
    { body: "export const a = defect.bind(null, 'x', { code: 'E2801' })", needle: "bind" },
    { body: "export const a = defect.bind(null, 'x')", needle: "bind" },
  ];
  fc.assert(
    fc.property(fc.constantFrom(...cases), ({ body, needle }) => {
      const ds = run(body);
      expect(ds, body).toHaveLength(1);
      expect(pos(ds[0]), body).toEqual(at(body, needle));
      expect(ds[0]?.message).toBe(UNREADABLE);
    }),
    { seed: SEED, numRuns: cases.length * 2 },
  );
});

test("a spread argument in the detail's place, `defect('x', ...ds)`, is one E1455 at it, message `defect code check cannot read`", () => {
  const body = "export const a = defect('x', ...ds)";
  const found = run(body);
  expect(found).toHaveLength(1);
  expect(pos(found[0])).toEqual(at(body, "...ds"));
  expect(found[0]?.message).toBe(UNREADABLE);
  expect(found[0]?.fix).toBeUndefined();
});

test("an `apply` array holding a spread in the detail's place, `defect.apply(null, ['x', ...ds])`, is one E1455 at that value, message `defect code check cannot read`", () => {
  for (const body of [
    "export const a = defect.apply(null, ['x', ...ds])",
    "export const a = Reflect.apply(defect, null, ['x', ...ds])",
  ]) {
    const found = run(body);
    expect(found, body).toHaveLength(1);
    expect(pos(found[0]), body).toEqual(at(body, "['x', ...ds]"));
    expect(found[0]?.message, body).toBe(UNREADABLE);
  }
});

test("a third argument that is a spread, `defect('x', {}, ...ds)`, is one E1455 at it, message `defect detail is not an object literal`", () => {
  const body = "export const a = defect('x', {}, ...ds)";
  const found = run(body);
  expect(found).toHaveLength(1);
  expect(pos(found[0])).toEqual(at(body, "...ds"));
  expect(found[0]?.message).toBe("defect detail is not an object literal");
  expect(found[0]?.fix).toBeUndefined();
});
