// Spec: k.reactive, clause "In a module the compiler compiled, `export const r = owner()` at its top level is a scope whose `parent` is undefined; a store that `r.run(() => store(S, { n: 0 }, { id: 'm.a' }))` makes inside `c.run(...)`, `c` a `detached` scope, is listed by `stores()` outside every scope after `c.dispose()`, and after `r.dispose()` it is not."
// Spec: k.reactive, clause "Outside every scope and module root, `scope(() => undefined)` throws a value `isDefect(v, 'E1208')` accepts and `store(S, { n: 0 })` one `isDefect(v, 'E1203')` accepts; `scope(() => undefined, { detached: true })` returns a scope with no `parent`; after `await Promise.resolve()` inside `c.run(async () => ...)`, `scope(() => undefined)` throws the E1208 defect."
// The store half of these clauses lives here: @keel/reactive's conformance may not import @keel/store (dependency order).
// Seed 1337.
// Assumption: this file is the "module the compiler compiled": the package's `keelConfig` runs each top-level statement holding a call in a module root, so each `export const r... = owner()` below is a root of its own.
import { type Scope, owner, scope } from "@keel/reactive";
import { isDefect, s } from "@keel/schema";
import { store, stores } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const S = s.object({ n: s.number() });
const ident = fc.stringMatching(/^[a-z]{3,8}$/);

export const rOne = owner();
export const rProp = owner();

const need = (r: Scope | undefined): Scope => {
  if (r === undefined) throw new Error("owner() at a compiled module's top level is undefined: no module root ran it");
  return r;
};
const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
};
const running = (): Scope => scope(() => undefined, { detached: true });

describe("k.reactive: module roots own the stores they make", () => {
  it("a store that `r.run(() => store(S, { n: 0 }, { id: 'm.a' }))` makes inside `c.run(...)` is listed by `stores()` outside every scope after `c.dispose()`, and after `r.dispose()` it is not", () => {
    const r = need(rOne);
    expect(r.parent).toBeUndefined();
    const c = running();
    try {
      c.run(() => r.run(() => store(S, { n: 0 }, { id: "m.a" })));
      expect(stores().has("m.a")).toBe(true);
      c.dispose();
      expect(stores().has("m.a")).toBe(true);
      r.dispose();
      expect(stores().has("m.a")).toBe(false);
    } finally {
      c.dispose();
    }
  });

  it("property: for any module and store id, a store made in a scope nested in the module root outlives the running scope and ends with its own scope", () => {
    const r = need(rProp);
    fc.assert(
      fc.property(ident, ident, (mod, name) => {
        const id = `${mod}.${name}`;
        const h = r.run(() => scope(() => undefined));
        const c = running();
        try {
          expect(h.parent).toBe(r);
          c.run(() => h.run(() => store(S, { n: 0 }, { id })));
          expect(stores().has(id)).toBe(true);
          c.dispose();
          expect(stores().has(id)).toBe(true);
          h.dispose();
          expect(stores().has(id)).toBe(false);
        } finally {
          c.dispose();
          h.dispose();
        }
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("k.reactive: outside every scope and module root", () => {
  it("`store(S, { n: 0 })` throws a value `isDefect(v, 'E1203')` accepts", () => {
    expect(owner()).toBeUndefined();
    const v = thrown(() => store(S, { n: 0 }));
    expect(isDefect(v, "E1203")).toBe(true);
    expect(isDefect(v, "E1208")).toBe(false);
  });

  it("`scope(() => undefined)` throws a value `isDefect(v, 'E1208')` accepts", () => {
    expect(
      isDefect(
        thrown(() => scope(() => undefined)),
        "E1208",
      ),
    ).toBe(true);
  });

  it("after `await Promise.resolve()` inside `c.run(async () => ...)`, `scope(() => undefined)` throws the E1208 defect and `store(S, { n: 0 })` the E1203 defect", async () => {
    const c = running();
    try {
      const out = await c.run(async () => {
        await Promise.resolve();
        return { sc: thrown(() => scope(() => undefined)), st: thrown(() => store(S, { n: 0 })) };
      });
      expect(isDefect(out.sc, "E1208")).toBe(true);
      expect(isDefect(out.st, "E1203")).toBe(true);
    } finally {
      c.dispose();
    }
  });

  it("`scope(() => undefined, { detached: true })` returns a scope with no `parent`", () => {
    const c = running();
    try {
      expect(c.parent).toBeUndefined();
    } finally {
      c.dispose();
    }
  });
});
