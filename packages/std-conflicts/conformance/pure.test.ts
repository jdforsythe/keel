// Spec: std.conflicts, clause "`races` returns equal results for equal inputs and leaves `snapshot` and every live store unchanged."
// Seed 1337
// Assumption: a live store with the factory's id exists while `races` runs; `races` must not collide with it.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Op, STORE_ID, boardStores, open, snapshotOf, racesInRoot } from "./fixtures.ts";

const title = fc.stringMatching(/^[a-z]{1,6}$/);

function deepFreeze<T>(v: T): T {
  if (typeof v === "object" && v !== null) {
    for (const k of Object.keys(v)) deepFreeze(Reflect.get(v, k));
    Object.freeze(v);
  }
  return v;
}

describe("std.conflicts: races is pure", () => {
  test("`races` returns equal results for equal inputs", () => {
    fc.assert(
      fc.property(fc.uniqueArray(title, { minLength: 3, maxLength: 3 }), ([a, b, c]) => {
        if (a === undefined || b === undefined || c === undefined) throw new Error("generator: three titles");
        const ops: Op[] = [
          { t: "add", id: "x", title: a },
          { t: "add", id: "y", title: b },
          { t: "edit", id: "x", title: c, base: 2 },
          { t: "edit", id: "y", title: a, base: 2 },
          { t: "edit", id: "x", title: b, base: 2, key: "k" },
        ];
        const first = racesInRoot(snapshotOf({}, ops), boardStores());
        const second = racesInRoot(snapshotOf({}, ops), boardStores());
        expect(second).toEqual(first);
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  test("`races` leaves `snapshot` and every live store unchanged", () => {
    fc.assert(
      fc.property(title, title, (first, second) => {
        fc.pre(first !== second);
        const ops: Op[] = [
          { t: "add", id: "x", title: "start" },
          { t: "edit", id: "x", title: first, base: 1 },
          { t: "edit", id: "x", title: second, base: 1 },
        ];
        const snap = deepFreeze(snapshotOf({}, ops));
        const live = open({}, ops);
        try {
          const before = JSON.stringify(snap);
          const liveBefore = JSON.stringify(live.stores.board.snapshot({ meta: true }));
          const a = racesInRoot(snap, boardStores());
          const b = racesInRoot(snap, boardStores());
          expect(a).toEqual(b);
          expect(JSON.stringify(snap)).toBe(before);
          expect(JSON.stringify(live.stores.board.snapshot({ meta: true }))).toBe(liveBefore);
          expect(live.stores.board.head()).toBe(3);
          expect(live.stores.board.log()).toHaveLength(3);
          expect(live.stores.board.id).toBe(STORE_ID);
        } finally {
          live.dispose();
        }
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
});
