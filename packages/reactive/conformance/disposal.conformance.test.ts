// Spec: k.reactive, clause "Disposal frees all subscriptions". Property seed: 1337.
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { signal, computed, effect, scope } from "@keel/reactive";

const SEED = 1337;

describe("k.reactive: disposal frees all subscriptions", () => {
  it("after scope dispose, writes trigger no effect runs", () => {
    let runs = 0;
    let set: (v: number) => void = () => {};
    const h = scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        effect(() => {
          s.get();
          runs++;
        });
      },
      { detached: true },
    );
    expect(runs).toBe(1);
    h.dispose();
    set(1);
    set(2);
    expect(runs).toBe(1);
  });

  it("after scope dispose, a computed is not recomputed", () => {
    let computes = 0;
    let set: (v: number) => void = () => {};
    const h = scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        const c = computed(() => {
          computes++;
          return s.get() * 2;
        });
        effect(() => {
          c.get();
        });
      },
      { detached: true },
    );
    const before = computes;
    h.dispose();
    set(5);
    expect(computes).toBe(before);
  });

  it("disposing an effect handle stops only that effect", () => {
    let a = 0;
    let b = 0;
    scope(
      () => {
        const s = signal(0);
        const ea = effect(() => {
          s.get();
          a++;
        });
        effect(() => {
          s.get();
          b++;
        });
        ea.dispose();
        s.set(1);
      },
      { detached: true },
    );
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it("dispose is idempotent", () => {
    const h = scope(
      () => {
        signal(0);
      },
      { detached: true },
    );
    h.dispose();
    expect(() => h.dispose()).not.toThrow();
  });

  it("property: any write sequence after dispose causes zero effect runs and zero recomputes", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 20 }), (writes) => {
        let runs = 0;
        let computes = 0;
        let set: (v: number) => void = () => {};
        const h = scope(
          () => {
            const s = signal(0);
            set = (v) => s.set(v);
            const c = computed(() => {
              computes++;
              return s.get();
            });
            effect(() => {
              c.get();
              runs++;
            });
          },
          { detached: true },
        );
        h.dispose();
        const r0 = runs;
        const c0 = computes;
        for (const w of writes) set(w);
        expect(runs).toBe(r0);
        expect(computes).toBe(c0);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
