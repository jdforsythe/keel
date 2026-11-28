// Spec: k.errors, clause "In `modules/m/a.ts`, `throw new Error('x')` is one E1451, message `throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')`, `new Promise((res, rej) => rej(x))` and `new Promise((_res, rej) => { on(rej) })` are one each at the second parameter, and `new Promise(start)` with `start` a name is one at `start`; `defect('x')` (imported from `@keel/schema`), `new Promise((res) => res(1))` and `new Promise<Result<number, E>>((res) => res(err(T)))` are none."
// Seed 1337.
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";
import { at, of, run } from "./rules-support.ts";

const MESSAGE = "throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')";
const HEAD =
  "import { defect, err } from '@keel/schema'\nimport type { Result, KeelError } from '@keel/schema'\ndeclare const x: unknown\ndeclare function on(f: unknown): void\ndeclare function start(res: () => void, rej: () => void): void\ntype E = KeelError<'m.e', null>\ndeclare const T: E\n";
const src = (stmt: string) => `${HEAD}export function a(): unknown { ${stmt} }\n`;
const E1451 = (stmt: string) => of(run(src(stmt)), "E1451");

test("`throw new Error('x')` is one E1451 with the message that names both the Result and the defect", () => {
  const ds = E1451("throw new Error('x')");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MESSAGE);
});

test("property: every thrown expression is one E1451 with that message", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("new Error('x')", "x", "new RangeError('y')", "'text'", "T", "{ code: 'a.b' }"),
      (t) => {
        const ds = E1451(`throw ${t}`);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(MESSAGE);
      },
    ),
    { seed: SEED, numRuns: 20 },
  );
});

test("`new Promise((res, rej) => rej(x))` is one E1451 at the second parameter", () => {
  const s = src("return new Promise((res, rej) => rej(x))");
  const ds = of(run(s), "E1451");
  expect(ds).toHaveLength(1);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(s, "rej)", "new Promise"));
});

test("`new Promise((_res, rej) => { on(rej) })` is one E1451 at the second parameter", () => {
  const s = src("return new Promise((_res, rej) => { on(rej) })");
  const ds = of(run(s), "E1451");
  expect(ds).toHaveLength(1);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(s, "rej)", "new Promise"));
});

test("`new Promise(start)` with `start` a name is one E1451 at `start`", () => {
  const s = src("return new Promise(start)");
  const ds = of(run(s), "E1451");
  expect(ds).toHaveLength(1);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(s, "start)", "new Promise"));
});

test("`defect('x')`, `new Promise((res) => res(1))` and `new Promise<Result<number, E>>((res) => res(err(T)))` are no E1451", () => {
  for (const stmt of [
    "return defect('x')",
    "return new Promise((res) => res(1))",
    "return new Promise<Result<number, E>>((res) => res(err(T)))",
  ]) {
    expect(E1451(stmt), stmt).toEqual([]);
  }
});
