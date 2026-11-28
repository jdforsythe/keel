// Spec: k.errors, clause "`p.catch(g)`, `p.then(f, g)`, `Promise.allSettled(ps)` and `Promise.any(ps)` in `modules/m/a.ts` are one E1452 each whose message starts with the form (`.catch()`, `.then(f, g)`, `Promise.allSettled`, `Promise.any`) and ends ` in app code: await it; an expected failure is attempt(fn, expect)`."
// Seed 1337.
import { expect, test } from "vitest";
import { of, run } from "./rules-support.ts";

const HEAD =
  "declare const p: Promise<number>\ndeclare const ps: Promise<number>[]\ndeclare function f(): void\ndeclare function g(): void\n";
const FORMS: readonly (readonly [string, string])[] = [
  ["p.catch(g)", ".catch()"],
  ["p.then(f, g)", ".then(f, g)"],
  ["Promise.allSettled(ps)", "Promise.allSettled"],
  ["Promise.any(ps)", "Promise.any"],
];
for (const [expr, form] of FORMS) {
  test(`\`${expr}\` is one E1452 whose message starts \`${form}\` and ends \` in app code: await it; an expected failure is attempt(fn, expect)\``, () => {
    const ds = of(run(`${HEAD}export function a() { return ${expr} }\n`), "E1452");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message.startsWith(form)).toBe(true);
    expect(ds[0]?.message.endsWith(" in app code: await it; an expected failure is attempt(fn, expect)")).toBe(true);
  });
}
