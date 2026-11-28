// Spec: k.ctx, clause "In `modules/m/a.ts`, `export const a = (ctx: Ctx) => fetch(u)` is one E1601 whose fix gives `ctx.net.fetch(u)`; `export const a = () => fetch(u)` and `export const a = (c: Ctx) => Date.now()` are one E1601 each with no fix, the message naming `ctx.net.fetch` and `ctx.clock.now()`."
// k.ctx, Rules "The fix is the exact `ctx` equivalent, offered only where a binding named `ctx` (a parameter, a destructured one too, or a declaration) is in scope at the use; elsewhere the message names it and there is no fix."
// Seed 1337 (no generated input: the forms are source text). Type pass off, as the other E1601 files read it; `Ctx` and `u` are declared in the fixture.
// Reading: "the message naming `ctx.net.fetch` and `ctx.clock.now()`" is read as: the `fetch` one's message holds `ctx.net.fetch`, the `Date.now` one's `ctx.clock.now()`.
import { expect, test } from "vitest";
import { MANIFEST, PATH, applyFix, at, of, run } from "./rules-support.ts";

const HEAD = "import type { Ctx } from '@keel/ctx'\ndeclare const u: string\n";
const E1601 = (body: string) => {
  const source = `${HEAD}${body}\n`;
  return { source, ds: of(run(source), "E1601") };
};

test("`export const a = (ctx: Ctx) => fetch(u)` is one E1601 at the call whose fix gives `ctx.net.fetch(u)`", () => {
  const { source, ds } = E1601("export const a = (ctx: Ctx) => fetch(u)");
  expect(ds).toHaveLength(1);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(source, "fetch(u)"));
  const fix = ds[0]?.fix;
  expect(typeof fix).toBe("string");
  if (fix === undefined) return;
  const patched = applyFix([MANIFEST, { path: PATH, source }], fix).find((f) => f.path === PATH)?.source ?? "";
  expect(patched).toContain("export const a = (ctx: Ctx) => ctx.net.fetch(u)");
  expect(of(run(patched), "E1601")).toEqual([]);
});

test("`export const a = () => fetch(u)` is one E1601 with no fix, the message naming `ctx.net.fetch`", () => {
  const { ds } = E1601("export const a = () => fetch(u)");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect(ds[0]?.message).toContain("ctx.net.fetch");
});

test("`export const a = (c: Ctx) => Date.now()` is one E1601 with no fix, the message naming `ctx.clock.now()`", () => {
  const { ds } = E1601("export const a = (c: Ctx) => Date.now()");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect(ds[0]?.message).toContain("ctx.clock.now()");
});

test("a destructured `ctx` parameter and a `ctx` declaration in scope each get the fix", () => {
  for (const body of [
    "export const a = ({ ctx }: { ctx: Ctx }) => fetch(u)",
    "declare const ctx: Ctx\nexport const a = () => fetch(u)",
  ]) {
    const { ds } = E1601(body);
    expect(ds, body).toHaveLength(1);
    expect(typeof ds[0]?.fix, body).toBe("string");
  }
});
