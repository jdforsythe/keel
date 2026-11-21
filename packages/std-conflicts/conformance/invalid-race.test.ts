// Spec: std.conflicts, clause "A rebased entry whose other order fails an invariant is an `invalid` race."
// Seed 1337
// The fixture store's invariant: no two todos share a title.
import { races } from "@keel/std-conflicts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { STORE_ID, boardStores, snapshotOf } from "./fixtures.ts";

describe("std.conflicts: invalid races", () => {
  test("A rebased entry whose other order fails an invariant is an `invalid` race", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 3, maxLength: 3 }), ([a, b, c]) => {
        if (a === undefined || b === undefined || c === undefined) throw new Error("generator: three titles");
        // #1 x=a, #2 y=b, #3 x=c (plain), #4 y=a from head 2 (rebased). Live order (x=c, then y=a) holds; applying #4
        // first would give x and y the title `a`.
        const snap = snapshotOf({}, [
          { t: "add", id: "x", title: a },
          { t: "add", id: "y", title: b },
          { t: "edit", id: "x", title: c, base: 2 },
          { t: "edit", id: "y", title: a, base: 2 },
        ]);
        const r = races(snap, boardStores());
        expect(r.unchecked).toEqual([]);
        expect(r.races).toHaveLength(1);
        expect(r.races[0]).toMatchObject({
          store: STORE_ID,
          kind: "invalid",
          entry: { id: 4, name: "api.editTodo" },
        });
        expect(r.races[0]?.against).toHaveLength(1);
        expect(r.races[0]?.against[0]).toMatchObject({ id: 3, name: "api.editTodo" });
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});
