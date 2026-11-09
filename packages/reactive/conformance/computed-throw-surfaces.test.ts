// Spec: k.reactive Conformance, "An effect reading a computed that throws after a later write gets that throw from
// its own `get()`, where a `try` around the read catches it; no `onError` receives it." API: "A computed's throw
// surfaces in the computation reading it: the computed runs once per commit and keeps the error, each reader's
// `get()` throws it until a source changes, and its first value after a throw counts as a change."
// Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computed, effect, scope, signal } from "@keel/reactive";

const distinct = fc
  .tuple(fc.integer(), fc.integer(), fc.integer())
  .filter(([a, b, c]) => a !== b && b !== c && a !== c);

function mk(initial: number) {
  let s: ReturnType<typeof signal<number>> | undefined;
  scope(() => {
    s = signal(initial);
  });
  if (!s) throw new Error("unreachable");
  return s;
}

describe("k.reactive: a computed's throw surfaces in the reading effect", () => {
  it("an effect reading a computed that throws after a later write catches that throw around its own get(); no onError receives it", () => {
    fc.assert(
      fc.property(distinct, ([init, bad]) => {
        const s = mk(init);
        const seen: number[] = [];
        const caught: unknown[] = [];
        const received: unknown[] = [];
        const boom = new Error("computed boom");
        scope(
          () => {
            const c = computed(() => {
              if (s.get() === bad) throw boom;
              return s.get();
            });
            effect(() => {
              try {
                seen.push(c.get());
              } catch (e) {
                caught.push(e);
              }
            });
          },
          { onError: (e) => received.push(e) },
        );
        expect(seen).toEqual([init]);
        expect(() => s.set(bad)).not.toThrow();
        expect(caught).toEqual([boom]);
        expect(caught[0]).toBe(boom);
        expect(received).toEqual([]);
        expect(seen).toEqual([init]);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("the effect whose computed source throws still runs, and keeps running on a later write", () => {
    fc.assert(
      fc.property(distinct, ([init, bad, good]) => {
        const s = mk(init);
        const seen: number[] = [];
        const caught: unknown[] = [];
        const received: unknown[] = [];
        scope(
          () => {
            const c = computed(() => {
              if (s.get() === bad) throw new Error("computed boom");
              return s.get();
            });
            effect(() => {
              try {
                seen.push(c.get());
              } catch (e) {
                caught.push(e);
              }
            });
          },
          { onError: (e) => received.push(e) },
        );
        s.set(bad);
        expect(() => s.set(good)).not.toThrow();
        expect(seen).toEqual([init, good]);
        expect(caught).toHaveLength(1);
        expect(received).toEqual([]);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
