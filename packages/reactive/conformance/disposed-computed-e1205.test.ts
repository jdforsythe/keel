import { computed, effect, scope, signal } from "@keel/reactive";
import type { Computed, Signal } from "@keel/reactive";
// Spec: k.reactive Rules E1205 "reading a `computed` whose scope is disposed is E1205"; Conformance "reading a
// computed after its scope is disposed throws E1205, also from a live effect that reads it". Property seed: 1337.
// The effect case has no onError on its scope, so the throw surfaces from the `set` that re-runs the effect.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

function errorOf(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

function expectE1205(e: unknown): void {
  expect(e).toBeInstanceOf(Error);
  if (!(e instanceof Error)) throw new Error("unreachable");
  expect("code" in e && e.code).toBe("E1205");
  expect(e.message.startsWith("E1205")).toBe(true);
}

function sig(v: number): Signal<number> {
  const out: Signal<number>[] = [];
  scope(() => {
    out.push(signal(v));
  });
  const s = out[0];
  if (s === undefined) throw new Error("unreachable");
  return s;
}

function owned(fn: () => number): { c: Computed<number>; dispose: () => void } {
  const out: Computed<number>[] = [];
  const h = scope(() => {
    out.push(computed(fn));
  });
  const c = out[0];
  if (c === undefined) throw new Error("unreachable");
  return { c, dispose: () => h.dispose() };
}

describe("k.reactive: reading a disposed computed", () => {
  it("reading a computed after its scope is disposed throws E1205", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -10, max: 10 }), (v, k) => {
        const s = sig(v);
        const { c, dispose } = owned(() => s.get() * k);
        expect(c.get()).toBe(v * k);
        dispose();
        expectE1205(errorOf(() => c.get()));
        s.set(v + 1);
        expectE1205(errorOf(() => c.get()));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("reading a computed whose scope is live does not throw (clean counterpart)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (v) => {
        const s = sig(v);
        const { c, dispose } = owned(() => s.get() + 1);
        expect(errorOf(() => c.get())).toBeUndefined();
        s.set(v + 1);
        expect(c.get()).toBe(v + 2);
        dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("reading a computed after its scope is disposed throws E1205, also from a live effect that reads it", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (v) => {
        const s = sig(v);
        const { c, dispose } = owned(() => s.get() * 2);
        const seen: number[] = [];
        const effectScope = scope(() => {
          effect(
            () => {
              s.get();
              seen.push(c.get());
            },
            { writes: [] },
          );
        });
        expect(seen).toEqual([v * 2]);
        dispose();
        expectE1205(errorOf(() => s.set(v + 1)));
        expect(seen).toEqual([v * 2]);
        effectScope.dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
