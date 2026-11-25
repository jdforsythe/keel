// Spec: std.conflicts, clause "A rebased entry whose `base` is older than the kept log is `unchecked` `folded`; one after an undo since the kept log's start is `unchecked` `undo`."
// std.conflicts, rule W2702: a rebased entry whose base state cannot be rebuilt (`folded`, `undo`).
// Seed 1337
// Assumption: with `logLimit` 2, the kept log's initial state is the state after the entry just before the kept log, so a
// `base` equal to that entry's id is rebuildable and an older one is `folded`.
import { races } from "@keel/std-conflicts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { STORE_ID, boardStores, snapshotOf } from "./fixtures.ts";

const title = fc.stringMatching(/^[a-z]{1,6}$/);

describe("std.conflicts: unchecked entries", () => {
  test("A rebased entry whose `base` is older than the kept log is `unchecked` `folded`", () => {
    fc.assert(
      fc.property(fc.uniqueArray(title, { minLength: 3, maxLength: 3 }), ([t1, t2, t3]) => {
        if (t1 === undefined || t2 === undefined || t3 === undefined) throw new Error("generator: three titles");
        // logLimit 2: after #4 the kept log is #3, #4 and #1, #2 are folded; #4 has base 1.
        const snap = snapshotOf({ logLimit: 2 }, [
          { t: "add", id: "x", title: "x" },
          { t: "edit", id: "x", title: t1, base: 1 },
          { t: "edit", id: "x", title: t2, base: 2 },
          { t: "edit", id: "x", title: t3, base: 1 },
        ]);
        const r = races(snap, boardStores({ logLimit: 2 }));
        expect(r.races).toEqual([]);
        expect(r.unchecked).toEqual([{ store: STORE_ID, id: 4, reason: "folded" }]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("a rebased entry whose `base` is the last folded entry is checked, not unchecked", () => {
    fc.assert(
      fc.property(fc.uniqueArray(title, { minLength: 3, maxLength: 3 }), ([t1, t2, t3]) => {
        if (t1 === undefined || t2 === undefined || t3 === undefined) throw new Error("generator: three titles");
        // the same shape with #4 from head 2: the state at 2 is the kept log's `initial`.
        const snap = snapshotOf({ logLimit: 2 }, [
          { t: "add", id: "x", title: "x" },
          { t: "edit", id: "x", title: t1, base: 1 },
          { t: "edit", id: "x", title: t2, base: 2 },
          { t: "edit", id: "x", title: t3, base: 2 },
        ]);
        const r = races(snap, boardStores({ logLimit: 2 }));
        expect(r.unchecked).toEqual([]);
        expect(r.races).toHaveLength(1);
        expect(r.races[0]).toMatchObject({ kind: "order", entry: { id: 4 }, against: [{ id: 3 }] });
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("A rebased entry after an undo since the kept log's start is `unchecked` `undo`", () => {
    fc.assert(
      fc.property(fc.uniqueArray(title, { minLength: 2, maxLength: 2 }), ([t1, t2]) => {
        if (t1 === undefined || t2 === undefined) throw new Error("generator: two titles");
        // #1 add, #2 edit, undo (head 3, id 3 is a gap), #4 rebased from head 1: the gap lies before it.
        const snap = snapshotOf({}, [
          { t: "add", id: "x", title: "x" },
          { t: "edit", id: "x", title: t1, base: 1 },
          { t: "undo" },
          { t: "edit", id: "x", title: t2, base: 1 },
        ]);
        const r = races(snap, boardStores());
        expect(r.races).toEqual([]);
        expect(r.unchecked).toEqual([{ store: STORE_ID, id: 4, reason: "undo" }]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("W2702 a rebased entry whose base state cannot be rebuilt is reported in `unchecked` with its reason, in log order", () => {
    // folded entry #4 (base 1) and, after the fold, nothing else rebased: one unchecked entry per such entry.
    const snap = snapshotOf({ logLimit: 3 }, [
      { t: "add", id: "x", title: "x" },
      { t: "edit", id: "x", title: "a", base: 1 },
      { t: "edit", id: "x", title: "b", base: 2 },
      { t: "edit", id: "x", title: "c", base: 1 },
      { t: "edit", id: "x", title: "d", base: 1 },
    ]);
    const r = races(snap, boardStores({ logLimit: 3 }));
    expect(r.unchecked).toEqual([
      { store: STORE_ID, id: 4, reason: "folded" },
      { store: STORE_ID, id: 5, reason: "folded" },
    ]);
  });
});
