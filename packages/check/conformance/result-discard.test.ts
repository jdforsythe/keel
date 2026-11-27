// Spec: k.errors, clause "In `modules/m/a.ts` with `rr` typed `() => Result<number, E>`: `rr()`, `void rr()`, `void (await prr())` with `prr` its `async` twin, and the statement `rr()` inside `attempt(() => { rr(); return 1 }, expect)` are one E1453 each, message `Result discarded: narrow on r.ok and handle r.error`, with no fix; `return rr()` and `const r = rr(); if (!r.ok) return r` are none."
// Seed 1337.
import { expect, test } from "vitest";
import { of, run } from "./rules-support.ts";

const MESSAGE = "Result discarded: narrow on r.ok and handle r.error";
const HEAD =
  "import { attempt } from '@keel/schema'\nimport type { Result, KeelError } from '@keel/schema'\ntype E = KeelError<'m.e', null>\ndeclare const rr: () => Result<number, E>\ndeclare const prr: () => Promise<Result<number, E>>\ndeclare const expect: (x: unknown) => E | undefined\n";
const src = (stmt: string) => `${HEAD}export async function a() { ${stmt} }\n`;

for (const stmt of ["rr()", "void rr()", "void (await prr())", "attempt(() => { rr(); return 1 }, expect)"]) {
  test(`\`${stmt}\` is one E1453, message \`Result discarded: narrow on r.ok and handle r.error\`, with no fix`, () => {
    const ds = of(run(src(stmt)), "E1453");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(MESSAGE);
    expect(ds[0]?.fix).toBeUndefined();
  });
}

test("`return rr()` and `const r = rr(); if (!r.ok) return r` are no E1453", () => {
  expect(of(run(src("return rr()")), "E1453")).toEqual([]);
  expect(of(run(src("const r = rr(); if (!r.ok) return r; return r")), "E1453")).toEqual([]);
});
