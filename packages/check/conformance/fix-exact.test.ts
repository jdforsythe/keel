// Spec: k.fixes, clause "In `modules/m/a.ts`, `function f(): Result<number, Locked> { if (bad) throw Locked.make({}); return ok(1) }` is one E1451 whose fix gives `return err(Locked.make({}))`; `throw new Error('x')` there, `throw Locked.make({})` in a function declared `: number`, and `throw Locked.make({})` in a function declared `Promise<void>` are one E1451 each with no fix."
// Spec: k.fixes, clause "In `modules/m/a.ts`, `try { await work(); await commit() } catch (e) { await rollback(); throw e }` is one E1452 whose fix gives `let done = false`, then `try { await work(); await commit(); done = true } finally { if (!done) { await rollback() } }`; where the function already declares `done` the name is `done2`; `try { f() } catch (e) { throw e }` is one whose fix gives `f()` alone."
// Spec: k.fixes, clause "In `modules/m/a.ts`, `try { return f() } catch (e) { undo(); throw e }`, `try { f() } catch (e) { log(e); throw e }`, `try { f() } catch { g() }`, `try { f() } catch {}`, `try { f() } catch (e) { if (e instanceof RangeError) return 0; throw e }`, `p.catch(g)` and `p.then(f, g)` are one E1452 each with no fix."
// Seed 1337. Each fixed project is checked with the type pass on and must report nothing (the fix compiles in place).
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { MANIFEST, PATH, applyFix, checked, codesOf, of, run } from "./rules-support.ts";

const HEAD =
  "import { err, ok } from '@keel/schema'\nimport type { KeelError, Result } from '@keel/schema'\ntype Locked = KeelError<'m.locked', Record<string, never>>\ndeclare const Locked: { make(d: Record<string, never>): Locked }\ndeclare const bad: boolean\n";
const DECL =
  "declare function work(): Promise<void>\ndeclare function commit(): Promise<void>\ndeclare function rollback(): Promise<void>\ndeclare function f(): number\ndeclare function undo(): void\ndeclare function log(e: unknown): void\ndeclare function g(): void\ndeclare const p: Promise<number>\n";
const fixed = (source: string, code: string): string => {
  const files = [MANIFEST, { path: PATH, source }];
  const ds = of(checked(files), code);
  expect(ds).toHaveLength(1);
  const fix = ds[0]?.fix;
  expect(typeof fix).toBe("string");
  const out = applyFix(files, fix ?? "");
  expect(codesOf(checked(out))).toEqual([]);
  return out.find((x) => x.path === PATH)?.source ?? "";
};

test(
  "`function f(): Result<number, Locked> { if (bad) throw Locked.make({}); return ok(1) }` is one E1451 whose fix gives `return err(Locked.make({}))`",
  () => {
    const out = fixed(
      `${HEAD}export function a(): Result<number, Locked> { if (bad) throw Locked.make({}); return ok(1) }\n`,
      "E1451",
    );
    expect(out).toContain("return err(Locked.make({}))");
    expect(out).not.toContain("throw");
  },
  CHECK_CASE_BOUND,
);

for (const [name, body] of [
  ["`throw new Error('x')` there", "export function a(): Result<number, Locked> { throw new Error('x') }"],
  [
    "`throw Locked.make({})` in a function declared `: number`",
    "export function a(): number { throw Locked.make({}) }",
  ],
  [
    "`throw Locked.make({})` in a function declared `Promise<void>`",
    "export async function a(): Promise<void> { throw Locked.make({}) }",
  ],
] as const) {
  test(`${name} is one E1451 with no fix`, () => {
    const ds = of(run(`${HEAD}${body}\n`), "E1451");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.fix).toBeUndefined();
  });
}

test(
  "`try { await work(); await commit() } catch (e) { await rollback(); throw e }` is one E1452 whose fix is the done flag and finally",
  () => {
    const out = fixed(
      `${DECL}export async function a(): Promise<void> { try { await work(); await commit() } catch (e) { await rollback(); throw e } }\n`,
      "E1452",
    );
    expect(out).toContain("let done = false");
    expect(out).toContain(
      "try { await work(); await commit(); done = true } finally { if (!done) { await rollback() } }",
    );
    expect(out).not.toContain("catch");
  },
  CHECK_CASE_BOUND,
);

test(
  "where the function already declares `done` the name is `done2`",
  () => {
    const out = fixed(
      `${DECL}export async function a(): Promise<number> { const done = 1; try { await work(); await commit() } catch (e) { await rollback(); throw e } return done }\n`,
      "E1452",
    );
    expect(out).toContain("let done2 = false");
    expect(out).toContain("done2 = true");
    expect(out).toContain("if (!done2) { await rollback() }");
  },
  CHECK_CASE_BOUND,
);

test(
  "`try { f() } catch (e) { throw e }` is one E1452 whose fix gives `f()` alone",
  () => {
    const out = fixed(`${DECL}export function a(): void { try { f() } catch (e) { throw e } }\n`, "E1452");
    expect(out).toContain("{ f() }");
    expect(out).not.toMatch(/try|catch|finally|done/);
  },
  CHECK_CASE_BOUND,
);

for (const body of [
  "try { return f() } catch (e) { undo(); throw e }",
  "try { f() } catch (e) { log(e); throw e }",
  "try { f() } catch { g() }",
  "try { f() } catch {}",
  "try { f() } catch (e) { if (e instanceof RangeError) return 0; throw e }",
  "return p.catch(g)",
  "return p.then(f, g)",
]) {
  test(`\`${body}\` is one E1452 with no fix`, () => {
    const ds = of(run(`${DECL}export function a(): unknown { ${body} }\n`), "E1452");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.fix).toBeUndefined();
  });
}
