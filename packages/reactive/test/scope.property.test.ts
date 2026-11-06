// Properties of ownership scopes. fast-check seed 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effect, scope, signal } from "../src/index.ts";
import type { Scope } from "../src/index.ts";

const SEED = 1337;

describe("scope properties", () => {
  it("disposing any scope in a random tree stops exactly the effects inside its subtree", () => {
    // parents[i] is the parent index of scope i+1 (scope 0 is the root).
    const treeArb = fc
      .array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 10 })
      .map((ps) => ps.map((p, i) => p % (i + 1)));
    fc.assert(
      fc.property(
        treeArb,
        fc.nat({ max: 1000 }),
        fc.array(fc.integer(), { minLength: 1, maxLength: 5 }),
        (parents, pick, writes) => {
          const n = parents.length + 1;
          const children: number[][] = Array.from({ length: n }, () => []);
          parents.forEach((p, i) => children[p]?.push(i + 1));
          const runs = Array.from({ length: n }, () => 0);
          const handles: Scope[] = [];
          let set: (v: number) => void = () => {};
          const build = (i: number, s: { get(): number }): void => {
            handles[i] = scope(() => {
              effect(() => {
                s.get();
                runs[i] = (runs[i] ?? 0) + 1;
              });
              for (const c of children[i] ?? []) build(c, s);
            });
          };
          const root = scope(() => {
            const s = signal(Number.NaN);
            set = (v) => s.set(v);
            build(0, s);
          });
          const target = pick % n;
          const inside = new Set<number>();
          const walk = (i: number): void => {
            inside.add(i);
            for (const c of children[i] ?? []) walk(c);
          };
          walk(target);
          handles[target]?.dispose();
          const before = [...runs];
          writes.forEach((w, k) => set(w * 2 + k));
          runs.forEach((r, i) => {
            const delta = r - (before[i] ?? 0);
            expect(delta).toBe(inside.has(i) ? 0 : writes.length);
          });
          root.dispose();
          const after = [...runs];
          set(writes.length + 1e6);
          expect(runs).toEqual(after);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });
});
