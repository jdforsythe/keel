// Spec: std.conflicts, clause "Entries without `base` are never examined: a snapshot with none gives `{ races: [], unchecked: [] }`."
// Seed 1337
import { races } from "@keel/std-conflicts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Op, boardStores, snapshotOf } from "./fixtures.ts";

type Kind = "add" | "edit" | "toggle";
const kinds = fc.array(fc.tuple(fc.constantFrom<Kind>("add", "edit", "toggle"), fc.boolean()), { maxLength: 12 });

describe("std.conflicts: entries without base", () => {
  test("Entries without `base` are never examined: a snapshot with none gives `{ races: [], unchecked: [] }`", () => {
    fc.assert(
      fc.property(kinds, (plan) => {
        // every op is an ordinary commit (no `base`, or the head as `base`); some carry a write `key`
        const ops: Op[] = [{ t: "add", id: "i0", title: "t0" }];
        let head = 1;
        plan.forEach(([kind, keyed], n) => {
          const key = keyed ? { key: `k${n}` } : {};
          if (kind === "add") ops.push({ t: "add", id: `i${n + 1}`, title: `t${n + 1}`, ...key });
          else if (kind === "edit") ops.push({ t: "edit", id: "i0", title: `e${n}`, base: head, ...key });
          else ops.push({ t: "toggle", id: "i0", ...key });
          head++;
        });
        expect(races(snapshotOf({}, ops), boardStores())).toEqual({ races: [], unchecked: [] });
      }),
      { seed: 1337, numRuns: 40 },
    );
  });

  test("an empty store's snapshot gives `{ races: [], unchecked: [] }`", () => {
    expect(races(snapshotOf({}, []), boardStores())).toEqual({ races: [], unchecked: [] });
  });
});
