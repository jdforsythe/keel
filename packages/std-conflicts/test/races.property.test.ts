// Seed 1337
import { owner, scope } from "@keel/reactive";
import { races } from "@keel/std-conflicts";
import { isolate } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, type Step, boardStores, deepFreeze, snapshotAfter, tallyStores } from "./helpers.ts";

/** Commuting steps, each from a base at or below the head it lands on. */
const commuting = fc
  .array(fc.tuple(fc.boolean(), fc.integer({ min: -5, max: 5 }), fc.nat()), { minLength: 1, maxLength: 12 })
  .map((plan) =>
    plan.map(([inc, v, back], i): Step => {
      const base = Math.max(0, i - (back % 4));
      return inc ? { name: "t.inc", payload: { by: v }, base } : { name: "t.put", payload: { id: `i${i}`, v }, base };
    }),
  );

describe("races: properties", () => {
  test("commuting transactions never race", () => {
    fc.assert(
      fc.property(commuting, (steps) => {
        expect(races(snapshotAfter(tallyStores(), steps), tallyStores())).toEqual({ races: [], unchecked: [] });
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  test("a race is symmetric in what it reports: swapping the two titles reports the same race", () => {
    const title = fc.stringMatching(/^[a-z]{1,6}$/);
    fc.assert(
      fc.property(title, title, fc.integer({ min: 0, max: 3 }), (x, y, extra) => {
        fc.pre(x !== y);
        const log = (first: string, second: string): Step[] => [
          { name: "t.add", payload: { id: "a", title: "start" } },
          { name: "t.rename", payload: { id: "a", title: first } },
          ...Array.from(
            { length: extra },
            (_, i): Step => ({ name: "t.add", payload: { id: `p${i}`, title: `p${i}` } }),
          ),
          { name: "t.rename", payload: { id: "a", title: second }, base: 1 },
        ];
        const one = races(snapshotAfter(boardStores(), log(x, y)), boardStores());
        const other = races(snapshotAfter(boardStores(), log(y, x)), boardStores());
        expect(one.races).toHaveLength(1);
        expect(other).toEqual(one);
        expect(one.races[0]?.against.map((r) => r.id)).toEqual(Array.from({ length: extra + 1 }, (_, i) => i + 2));
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("races is pure: equal results, the snapshot and a live store of the same id unchanged", () => {
    const step = fc.tuple(fc.constantFrom("t.add", "t.rename"), fc.integer({ min: 0, max: 3 }), fc.nat());
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 10 }), (plan) => {
        const steps: Step[] = [];
        plan.forEach(([name, n, back], i) => {
          const base = Math.max(0, i - (back % 3));
          steps.push(
            name === "t.add" || i === 0
              ? { name: "t.add", payload: { id: `i${i}`, title: `t${i}` }, base }
              : { name: "t.rename", payload: { id: `i${n % i}`, title: `r${i}` }, base },
          );
        });
        const snap = deepFreeze(snapshotAfter(boardStores(), steps));
        const text = JSON.stringify(snap);
        const sc = scope(() => {
          const live = boardStores()();
          const before = JSON.stringify(live.board.snapshot({ meta: true }));
          const a = races(snap, boardStores());
          const b = races(snap, boardStores());
          expect(JSON.stringify(b)).toBe(JSON.stringify(a));
          expect(JSON.stringify(snap)).toBe(text);
          expect(JSON.stringify(live.board.snapshot({ meta: true }))).toBe(before);
        });
        sc.dispose();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("races runs inside an isolated scope that already holds a store of the same id", () => {
    const snap = snapshotAfter(boardStores(), [{ name: "t.add", payload: { id: "a", title: "x" } }]);
    const sc = scope(() => {
      const own = owner();
      if (own !== undefined) isolate(own);
      boardStores()();
      expect(races(snap, boardStores())).toEqual({ races: [], unchecked: [] });
    });
    sc.dispose();
  });
});
