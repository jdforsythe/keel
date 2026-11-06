// Spec: k.reactive, clause "Glitch-free propagation". Property seed: 1337.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { signal, computed, effect, scope } from '@keel/reactive';

const SEED = 1337;

describe('k.reactive: glitch-free propagation', () => {
  it('diamond: one write yields exactly one effect run with a consistent value', () => {
    const seen: number[] = [];
    scope(() => {
      const a = signal(1);
      const b = computed(() => a.get() + 1);
      const c = computed(() => a.get() * 10);
      const d = computed(() => b.get() + c.get());
      effect(() => {
        seen.push(d.get());
      });
      expect(seen).toEqual([12]);
      a.set(2);
    });
    expect(seen).toEqual([12, 23]);
  });

  it('diamond: effect never observes a mix of old and new branch values', () => {
    const pairs: Array<[number, number]> = [];
    scope(() => {
      const a = signal(0);
      const b = computed(() => a.get());
      const c = computed(() => a.get());
      effect(() => {
        pairs.push([b.get(), c.get()]);
      });
      for (let i = 1; i <= 5; i++) a.set(i);
    });
    for (const [x, y] of pairs) expect(x).toBe(y);
    expect(pairs.length).toBe(6);
  });

  it('property: random DAG, one source write -> exactly one extra run matching the reference model', () => {
    const dagArb = fc.array(fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 3 }), {
      minLength: 1,
      maxLength: 10,
    });
    fc.assert(
      fc.property(dagArb, fc.integer({ min: 1, max: 100 }), (rawDeps, bump) => {
        // node i (value index i+1) depends on earlier value indices (0 = source).
        const deps = rawDeps.map((ds, i) => ds.map((x) => x % (i + 1)));
        const model = (src: number): number => {
          const vals = [src];
          for (const ds of deps) vals.push(1 + ds.reduce((s, k) => s + (vals[k] ?? 0), 0));
          return vals.reduce((s, v) => s + v, 0);
        };
        const seen: number[] = [];
        scope(() => {
          const src = signal(1);
          const nodes: Array<{ get(): number }> = [src];
          for (const ds of deps) {
            const snapshot = [...nodes];
            nodes.push(computed(() => 1 + ds.reduce((s, k) => s + (snapshot[k]?.get() ?? 0), 0)));
          }
          const sink = computed(() => nodes.reduce((s, n) => s + n.get(), 0));
          effect(() => {
            seen.push(sink.get());
          });
          src.set(1 + bump);
        });
        expect(seen).toEqual([model(1), model(1 + bump)]);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
