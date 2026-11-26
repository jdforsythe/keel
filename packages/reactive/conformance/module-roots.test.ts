// Spec: k.reactive, clause "Outside every scope, `const r = scope(() => undefined)` has `r.parent` undefined; a store `r.run(() => store(S, { n: 0 }, { id: 'm.a' }))` makes from inside `c.run(...)`, `c` a scope made outside every scope, is listed by `stores()` outside every scope after `c.dispose()`, and after `r.dispose()` it is not."
// Spec: k.reactive, clause "A scope made with `scope(fn, { onError })` inside `r.run(...)` called from inside `c.run(...)`, `r` and `c` as above, has `parent` `r`, its effects keep running after `c.dispose()`, and its `onError`, not `c`'s, receives its effect's throw."
// Seed 1337.
import { effect, owner, scope, signal } from "@keel/reactive";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

describe("k.reactive: module roots", () => {
  it("outside every scope, `const r = scope(() => undefined)` has `r.parent` undefined", () => {
    expect(owner()).toBeUndefined();
    const r = scope(() => undefined);
    expect(r.parent).toBeUndefined();
    r.dispose();
  });

  it("a root made where owner() is undefined has no parent however many roots exist, and each ends only with its own dispose()", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 4 }), (count, which) => {
        const roots = Array.from({ length: count }, () => scope(() => undefined));
        const target = roots[which % count];
        try {
          for (const r of roots) expect(r.parent).toBeUndefined();
          target?.dispose();
          for (const r of roots) {
            if (r === target) expect(() => r.run(() => 1)).toThrow(/E1206/);
            else expect(r.run(() => 1)).toBe(1);
          }
        } finally {
          for (const r of roots) r.dispose();
        }
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a scope made with `scope(fn, { onError })` inside `r.run(...)` called from inside `c.run(...)` has `parent` `r`, its effects keep running after `c.dispose()`, and its `onError`, not `c`'s, receives its effect's throw", () => {
    const cErrors: unknown[] = [];
    const ownErrors: unknown[] = [];
    const r = scope(() => undefined);
    const c = scope(() => undefined, { onError: (e) => cErrors.push(e) });
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
    } finally {
      c.dispose();
      r.dispose();
    }
  });

  it("property: effects of a scope nested in a root keep running after the running scope is disposed, once per write", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (writes) => {
        const r = scope(() => undefined);
        const c = scope(() => undefined);
        try {
          const sig = r.run(() => signal(0));
          let runs = 0;
          c.run(() =>
            r.run(() =>
              scope(
                () => {
                  effect(() => {
                    sig.get();
                    runs++;
                  });
                },
                { onError: () => undefined },
              ),
            ),
          );
          c.dispose();
          const base = runs;
          for (let i = 1; i <= writes; i++) sig.set(i);
          expect(runs - base).toBe(writes);
        } finally {
          c.dispose();
          r.dispose();
        }
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
