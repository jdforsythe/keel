// Spec: std.conflicts, clause "Two concurrent rebased toggles of one todo, and concurrent rebased adds of items with distinct `id`s, are no race."
// Seed 1337
import { races } from "@keel/std-conflicts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Op, boardStores, snapshotOf } from "./fixtures.ts";

describe("std.conflicts: commuting entries", () => {
  test("Two concurrent rebased toggles of one todo are no race", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), (extra) => {
        // #1 adds x; `extra` plain adds follow (heads 2..); then two toggles of x, both from head 1: both rebased.
        const ops: Op[] = [{ t: "add", id: "x", title: "x" }];
        for (let i = 0; i < extra + 1; i++) ops.push({ t: "add", id: `p${i}`, title: `p${i}`, base: 1 + i });
        ops.push({ t: "toggle", id: "x", base: 1 }, { t: "toggle", id: "x", base: 1 });
        expect(races(snapshotOf({}, ops), boardStores())).toEqual({ races: [], unchecked: [] });
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("Concurrent rebased adds of items with distinct `id`s are no race", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,5}$/), { minLength: 2, maxLength: 5 }), (ids) => {
        // #1 adds `seed`; every later add is from head 1, so each is rebased and concurrent with the others.
        const ops: Op[] = [{ t: "add", id: "seed", title: "seed" }];
        for (const id of ids) ops.push({ t: "add", id: `n-${id}`, title: `t-${id}`, base: 1 });
        const r = races(snapshotOf({}, ops), boardStores());
        expect(r.races).toEqual([]);
        expect(r.unchecked).toEqual([]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});
