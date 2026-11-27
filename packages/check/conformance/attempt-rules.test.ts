// Spec: k.attempt, clause "In `modules/m/a.ts`, `attempt(f)` is one E1452, message `attempt needs expect: (x) => x instanceof T ? E.make(data) : undefined`; `attempt(f, () => T)`, `attempt(f, (_x) => T)` and `attempt(f, (x) => T)` are one E1452 each at the function, message `expect claims every throw: test the thrown value`; `attempt(f, (x) => (x instanceof RangeError ? T : undefined))` is none; no E1452 here carries a fix."
// Spec: k.attempt, clause "In `modules/m/a.ts`, `err(new Error('x'))`, `err('x')` and `err({ code: 'a.b' })` are one E1458 each at the argument; `err(T)` is none; called untyped, `err('x')` throws a value `isDefect(v, 'E1458')` accepts."
// Spec: k.attempt, clause "In `modules/m/a.ts`, `JSON.parse(t)`, `new URL(t)`, `decodeURIComponent(t)`, `decodeURI(t)`, `atob(t)` and `BigInt(t)` with `t` a `string` are one E1457 each at the callee with the message its row names; `JSON.parse('{}')`, `BigInt(n)` with `n` a `number`, `URL.parse(t)` and `attempt(() => JSON.parse(t), (x) => (x instanceof SyntaxError ? T : undefined))` are none."
// Seed 1337. The run-time half of E1458 is packages/schema/conformance/err-keel-error.test.ts.
import { expect, test } from "vitest";
import { at, of, run } from "./rules-support.ts";

const HEAD =
  "import { attempt, err } from '@keel/schema'\nimport type { KeelError } from '@keel/schema'\ntype E = KeelError<'m.e', null>\ndeclare const T: E\ndeclare const f: () => number\ndeclare const t: string\ndeclare const n: number\n";
const src = (stmt: string) => `${HEAD}export function a() { return ${stmt} }\n`;
const NEEDS = "attempt needs expect: (x) => x instanceof T ? E.make(data) : undefined";
const CLAIMS = "expect claims every throw: test the thrown value";

test("`attempt(f)` is one E1452, message `attempt needs expect: (x) => x instanceof T ? E.make(data) : undefined`, with no fix", () => {
  const ds = of(run(src("attempt(f)")), "E1452");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(NEEDS);
  expect(ds[0]?.fix).toBeUndefined();
});

for (const fn of ["() => T", "(_x) => T", "(x) => T"]) {
  test(`\`attempt(f, ${fn})\` is one E1452 at the function, message \`expect claims every throw: test the thrown value\`, with no fix`, () => {
    const s = src(`attempt(f, ${fn})`);
    const ds = of(run(s), "E1452");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(CLAIMS);
    expect(ds[0]?.fix).toBeUndefined();
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(s, fn, "attempt(f,"));
  });
}

test("`attempt(f, (x) => (x instanceof RangeError ? T : undefined))` is no E1452", () => {
  expect(of(run(src("attempt(f, (x) => (x instanceof RangeError ? T : undefined))")), "E1452")).toEqual([]);
});

for (const arg of ["new Error('x')", "'x'", "{ code: 'a.b' }"]) {
  test(`\`err(${arg})\` is one E1458 at the argument, message \`err takes a KeelError: declare it with s.error(code, data) and pass X.make(data)\`, with no fix`, () => {
    const s = src(`err(${arg})`);
    const ds = of(run(s), "E1458");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe("err takes a KeelError: declare it with s.error(code, data) and pass X.make(data)");
    expect(ds[0]?.fix).toBeUndefined();
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(s, arg, "err("));
  });
}

test("`err(T)` is no E1458", () => {
  expect(of(run(src("err(T)")), "E1458")).toEqual([]);
});

const BUILT: readonly (readonly [string, string])[] = [
  ["JSON.parse(t)", "JSON.parse throws on bad text: use S.parseJson(text)"],
  ["new URL(t)", "new URL throws on a bad address: use URL.parse(text, base) and test for null"],
  ["decodeURIComponent(t)", "decodeURIComponent throws on bad input: call it inside attempt(fn, expect)"],
  ["decodeURI(t)", "decodeURI throws on bad input: call it inside attempt(fn, expect)"],
  ["atob(t)", "atob throws on bad input: call it inside attempt(fn, expect)"],
  ["BigInt(t)", "BigInt throws on bad input: call it inside attempt(fn, expect)"],
];
for (const [call, message] of BUILT) {
  test(`\`${call}\` with \`t\` a string is one E1457 at the callee, message \`${message}\`, with no fix`, () => {
    const ds = of(run(src(call)), "E1457");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(message);
    expect(ds[0]?.fix).toBeUndefined();
  });
}

test("`JSON.parse('{}')`, `BigInt(n)` with `n` a number, `URL.parse(t)` and a JSON.parse inside attempt(fn, expect) are no E1457", () => {
  for (const call of [
    "JSON.parse('{}')",
    "BigInt(n)",
    "URL.parse(t)",
    "attempt(() => JSON.parse(t), (x) => (x instanceof SyntaxError ? T : undefined))",
  ]) {
    expect(of(run(src(call)), "E1457"), call).toEqual([]);
  }
});
