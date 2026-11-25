// Spec: std.conflicts, clause "A rebased entry setting a todo's title after a concurrent entry setting it to another value is one `order` race whose `against` names that entry."
// std.conflicts, rule E2701: a rebased entry races its concurrent entries.
// Seed 1337
import { races } from "@keel/std-conflicts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { STORE_ID, boardStores, snapshotOf } from "./fixtures.ts";

const title = fc.stringMatching(/^[a-z]{1,8}$/);

describe("std.conflicts: order races", () => {
  test("A rebased entry setting a todo's title after a concurrent entry setting it to another value is one `order` race whose `against` names that entry", () => {
    fc.assert(
      fc.property(title, title, title, (initial, first, second) => {
        fc.pre(first !== second);
        // #1 adds the todo; #2 sets `first` (plain: base is the head); #3 sets `second` from head 1, so it is rebased.
        const snap = snapshotOf({}, [
          { t: "add", id: "x", title: initial },
          { t: "edit", id: "x", title: first, base: 1 },
          { t: "edit", id: "x", title: second, base: 1, key: "w1" },
        ]);
        const r = races(snap, boardStores());
        expect(r.unchecked).toEqual([]);
        expect(r.races).toHaveLength(1);
        expect(r.races[0]).toMatchObject({
          store: STORE_ID,
          kind: "order",
          entry: { id: 3, name: "api.editTodo", key: "w1" },
        });
        expect(r.races[0]?.against).toHaveLength(1);
        expect(r.races[0]?.against[0]).toMatchObject({ id: 2, name: "api.editTodo" });
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  test("E2701 a rebased entry races its concurrent entries: setting the same title in both orders is no race", () => {
    fc.assert(
      fc.property(title, title, (initial, both) => {
        const snap = snapshotOf({}, [
          { t: "add", id: "x", title: initial },
          { t: "edit", id: "x", title: both, base: 1 },
          { t: "edit", id: "x", title: both, base: 1 },
        ]);
        expect(races(snap, boardStores())).toEqual({ races: [], unchecked: [] });
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});
