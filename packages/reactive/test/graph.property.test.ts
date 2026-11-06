// Properties of the reactive graph. fast-check seed 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { batch, computed, effect, scope, signal } from "../src/index.ts";
import type { Signal } from "../src/index.ts";

const SEED = 1337;

/** A node reads earlier value indices (sources first) and either sums them or sums them mod 3. */
interface Spec {
  deps: number[];
  mod: boolean;
}
const SOURCES = 3;
const specArb = fc.array(
  fc.record({ deps: fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 3 }), mod: fc.boolean() }),
  { minLength: 1, maxLength: 12 },
);
/** A commit is one or more writes; more than one is wrapped in `batch`. */
const commitsArb = fc.array(
  fc.array(fc.tuple(fc.nat({ max: SOURCES - 1 }), fc.integer({ min: -5, max: 5 })), { minLength: 1, maxLength: 4 }),
  { maxLength: 15 },
);

const normalize = (raw: Spec[]): Spec[] =>
  raw.map((s, i) => ({ deps: s.deps.map((d) => d % (SOURCES + i)), mod: s.mod }));

/** Pure reference: every value index for the given source values. */
const model = (specs: Spec[], src: number[]): number[] => {
  const vals = [...src];
  for (const s of specs) {
    const sum = s.deps.reduce((acc, d) => acc + (vals[d] ?? 0), 0);
    vals.push(s.mod ? ((sum % 3) + 3) % 3 : sum);
  }
  return vals;
};

describe("graph properties", () => {
  it("for any DAG and write sequence, every computed equals its pure recomputation after each commit", () => {
    fc.assert(
      fc.property(specArb, commitsArb, (raw, commits) => {
        const specs = normalize(raw);
        const src = [0, 0, 0];
        scope(() => {
          const sources = src.map((v) => signal(v));
          const nodes: Array<{ get(): number }> = [...sources];
          for (const s of specs) {
            const snapshot = [...nodes];
            nodes.push(
              computed(() => {
                const sum = s.deps.reduce((acc, d) => acc + (snapshot[d]?.get() ?? 0), 0);
                return s.mod ? ((sum % 3) + 3) % 3 : sum;
              }),
            );
          }
          for (const commit of commits) {
            batch(() => {
              for (const [i, v] of commit) {
                sources[i]?.set(v);
                src[i] = v;
              }
            });
            expect(nodes.map((n) => n.get())).toEqual(model(specs, src));
          }
        });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("an effect on a sink runs once initially plus once per commit that changed the sink, seeing model values", () => {
    fc.assert(
      fc.property(specArb, commitsArb, (raw, commits) => {
        const specs = normalize(raw);
        const src = [0, 0, 0];
        const sinkOf = (): number =>
          model(specs, src)
            .slice(SOURCES)
            .reduce((a, b) => a + b, 0);
        const expected = [sinkOf()];
        const seen: number[] = [];
        scope(() => {
          const sources = src.map((v) => signal(v));
          const nodes: Array<{ get(): number }> = [...sources];
          for (const s of specs) {
            const snapshot = [...nodes];
            nodes.push(
              computed(() => {
                const sum = s.deps.reduce((acc, d) => acc + (snapshot[d]?.get() ?? 0), 0);
                return s.mod ? ((sum % 3) + 3) % 3 : sum;
              }),
            );
          }
          const sink = computed(() => nodes.slice(SOURCES).reduce((a, n) => a + n.get(), 0));
          effect(() => {
            seen.push(sink.get());
          });
          for (const commit of commits) {
            batch(() => {
              for (const [i, v] of commit) {
                sources[i]?.set(v);
                src[i] = v;
              }
            });
            const now = sinkOf();
            if (now !== expected[expected.length - 1]) expected.push(now);
          }
        });
        expect(seen).toEqual(expected);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("each computed recomputes at most once per commit", () => {
    fc.assert(
      fc.property(specArb, commitsArb, (raw, commits) => {
        const specs = normalize(raw);
        const counts = specs.map(() => 0);
        scope(() => {
          const sources = [0, 0, 0].map((v) => signal(v));
          const nodes: Array<{ get(): number }> = [...sources];
          specs.forEach((s, k) => {
            const snapshot = [...nodes];
            nodes.push(
              computed(() => {
                counts[k] = (counts[k] ?? 0) + 1;
                return s.deps.reduce((acc, d) => acc + (snapshot[d]?.get() ?? 0), 0);
              }),
            );
          });
          effect(() => {
            for (const n of nodes) n.get();
          });
          for (const commit of commits) {
            const before = [...counts];
            batch(() => {
              for (const [i, v] of commit) sources[i]?.set(v);
            });
            counts.forEach((c, k) => expect(c - (before[k] ?? 0)).toBeLessThanOrEqual(1));
          }
        });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("an effect writing a declared signal keeps downstream effects consistent after every commit", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 20 }), (writes) => {
        const seen: Array<[number, number]> = [];
        scope(() => {
          const s = signal(0);
          const doubled: Signal<number> = signal(0);
          effect(
            () => {
              doubled.set(s.get() * 2);
            },
            { writes: [doubled] },
          );
          effect(() => {
            seen.push([s.get(), doubled.get()]);
          });
          for (const w of writes) {
            s.set(w);
            const last = seen[seen.length - 1];
            expect(last).toEqual([w, w * 2]);
          }
        });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
