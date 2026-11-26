// Spec: k.reactive, clause "In a module the compiler compiled, `export const r = owner()` at its top level is a scope whose `parent` is undefined; a store that `r.run(() => store(S, { n: 0 }, { id: 'm.a' }))` makes inside `c.run(...)`, `c` a `detached` scope, is listed by `stores()` outside every scope after `c.dispose()`, and after `r.dispose()` it is not."
// Spec: k.reactive, clause "A scope made with `scope(fn, { onError })` inside `r.run(...)` called from inside `c.run(...)`, `r` and `c` as above, has `parent` `r`, its effects keep running after `c.dispose()`, and its `onError`, not `c`'s, receives its effect's throw."
// Spec: k.reactive, clause "Outside every scope and module root, `scope(() => undefined)` throws a value `isDefect(v, 'E1208')` accepts and `store(S, { n: 0 })` one `isDefect(v, 'E1203')` accepts; `scope(() => undefined, { detached: true })` returns a scope with no `parent`; after `await Promise.resolve()` inside `c.run(async () => ...)`, `scope(() => undefined)` throws the E1208 defect."
// Seed 1337.
// Assumption: this file is the "module the compiler compiled": the package's `keelConfig` runs each top-level statement holding a call in a module root, so each `export const r... = owner()` below is a root of its own.
// The store halves of the first and third clauses live in packages/store/conformance/module-roots-stores.test.ts (@keel/reactive's conformance may not import @keel/store, dependency order); here a signal and an effect stand where a store does.
import { type Scope, computed, effect, owner, resource, scope, signal } from "@keel/reactive";
import { isDefect } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

// One module root per test that disposes its root: each top-level declaration holding a call has a root of its own.
export const rParent = owner();
export const rLife = owner();
export const rNest = owner();
export const rEffects = owner();
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
/** A `detached` scope: the running scope `c` of the clauses, made where no owner runs. */
const running = (onError?: (e: unknown) => void): Scope =>
  scope(() => undefined, onError === undefined ? { detached: true } : { detached: true, onError });

describe("k.reactive: module roots", () => {
  it("in a module the compiler compiled, `export const r = owner()` at its top level is a scope whose `parent` is undefined", () => {
    const r = need(rParent);
    expect(r.parent).toBeUndefined();
    expect(owner()).toBeUndefined();
  });

  it("a signal and an effect that `r.run(...)` makes inside `c.run(...)`, `c` a `detached` scope, outlive `c.dispose()` and end with `r.dispose()`", () => {
    const r = need(rLife);
    const c = running();
    try {
      const sig = c.run(() => r.run(() => signal(0)));
      let runs = 0;
      c.run(() =>
        r.run(() =>
          effect(() => {
            sig.get();
            runs++;
          }),
        ),
      );
      expect(runs).toBe(1);
      c.dispose();
      sig.set(1);
      expect(runs).toBe(2);
      r.dispose();
      sig.set(2);
      expect(runs).toBe(2);
      expect(() => r.run(() => 1)).toThrow(/E1206/);
    } finally {
      c.dispose();
    }
  });

  it("a scope made with `scope(fn, { onError })` inside `r.run(...)` called from inside `c.run(...)` has `parent` `r`, its effects keep running after `c.dispose()`, and its `onError`, not `c`'s, receives its effect's throw", () => {
    const r = need(rNest);
    const cErrors: unknown[] = [];
    const ownErrors: unknown[] = [];
    const c = running((e) => cErrors.push(e));
    try {
      const sig = r.run(() => signal(0));
      let runs = 0;
      const inner = c.run(() =>
        r.run(() =>
          scope(
            () => {
              effect(() => {
                runs++;
                if (sig.get() === 2) throw new Error("boom");
              });
            },
            { onError: (e) => ownErrors.push(e) },
          ),
        ),
      );
      expect(inner.parent).toBe(r);
      c.dispose();
      const before = runs;
      sig.set(1);
      expect(runs).toBeGreaterThan(before);
      sig.set(2);
      expect(ownErrors).toHaveLength(1);
      expect(cErrors).toEqual([]);
      inner.dispose();
    } finally {
      c.dispose();
    }
  });

  it("property: a root made in a module root has `parent` that root, and its effects run once per write after the running scope is disposed", () => {
    const r = need(rProp);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (writes) => {
        const h = r.run(() => scope(() => undefined));
        const c = running();
        try {
          expect(h.parent).toBe(r);
          const sig = h.run(() => signal(0));
          let runs = 0;
          c.run(() =>
            h.run(() =>
              effect(() => {
                sig.get();
                runs++;
              }),
            ),
          );
          c.dispose();
          const base = runs;
          for (let i = 1; i <= writes; i++) sig.set(i);
          expect(runs - base).toBe(writes);
        } finally {
          c.dispose();
          h.dispose();
        }
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("property: scopes made through `r.run(...)` inside `c.run(...)` have `parent` `r` and outlive `c.dispose()`, for any count", () => {
    const r = need(rEffects);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (count) => {
        const c = running();
        try {
          const inner = Array.from({ length: count }, () => c.run(() => r.run(() => scope(() => undefined))));
          for (const sc of inner) expect(sc.parent).toBe(r);
          c.dispose();
          for (const sc of inner) expect(sc.run(() => 1)).toBe(1);
          for (const sc of inner) sc.dispose();
        } finally {
          c.dispose();
        }
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

describe("k.reactive: outside every scope and module root", () => {
  it("`scope(() => undefined)` throws a value `isDefect(v, 'E1208')` accepts", () => {
    expect(owner()).toBeUndefined();
    const v = thrown(() => scope(() => undefined));
    expect(isDefect(v, "E1208")).toBe(true);
    expect(v instanceof Error && v.message).toBe(
      "E1208 scope() with no owner outside a module's top level; nest it or use a captured scope's run",
    );
  });

  it("a reactive primitive made there throws a value `isDefect(v, 'E1203')` accepts", () => {
    const makers: readonly (readonly [string, () => unknown])[] = [
      ["signal", () => signal(0)],
      ["computed", () => computed(() => 1)],
      ["effect", () => effect(() => undefined)],
      ["resource", () => resource(() => Promise.resolve(1))],
    ];
    fc.assert(
      fc.property(fc.constantFrom(...makers), ([, make]) => {
        const v = thrown(make);
        expect(isDefect(v, "E1203")).toBe(true);
        expect(isDefect(v, "E1208")).toBe(false);
        expect(v instanceof Error && v.message.startsWith("E1203")).toBe(true);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`scope(() => undefined, { detached: true })` returns a scope with no `parent`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (count) => {
        const roots = Array.from({ length: count }, () => running());
        try {
          for (const r of roots) expect(r.parent).toBeUndefined();
        } finally {
          for (const r of roots) r.dispose();
        }
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("after `await Promise.resolve()` inside `c.run(async () => ...)`, `scope(() => undefined)` throws the E1208 defect", async () => {
    const c = running();
    try {
      const v = await c.run(async () => {
        await Promise.resolve();
        return thrown(() => scope(() => undefined));
      });
      expect(isDefect(v, "E1208")).toBe(true);
    } finally {
      c.dispose();
    }
  });

  it("after an `await` inside `c.run(async () => ...)`, a reactive primitive throws the E1203 defect, and `owner()` is undefined", async () => {
    const c = running();
    try {
      const out = await c.run(async () => {
        await Promise.resolve();
        return { v: thrown(() => signal(0)), o: owner() };
      });
      expect(isDefect(out.v, "E1203")).toBe(true);
      expect(out.o).toBeUndefined();
    } finally {
      c.dispose();
    }
  });
});
