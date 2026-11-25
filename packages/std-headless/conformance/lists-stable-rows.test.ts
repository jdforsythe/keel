// Spec: std.lists, clause "`stableRows` returns the same object for a key kept across a list change and a new one for an added key."
// Seed: 1337. Assumptions in lists-support.ts.
import { signal } from "@keel/reactive";
import { stableRows } from "@keel/std-headless";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, inScope } from "./lists-support.ts";

const keys = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,4}$/), { maxLength: 8 });

describe("std.lists: stableRows", () => {
  test("returns the same object for a key kept across a list change and a new one for an added key", () => {
    fc.assert(
      fc.property(keys, keys, (before, after) => {
        const { value } = inScope(() => {
          const list = signal<readonly string[]>(before);
          return {
            list,
            rows: stableRows(
              () => list.get(),
              (k) => k,
            ),
          };
        });
        const first = new Map(value.rows.get().map((r) => [r.key, r]));
        expect(value.rows.get().map((r) => r.key)).toEqual(before);
        value.list.set(after);
        const next = value.rows.get();
        expect(next.map((r) => r.key)).toEqual(after);
        for (const r of next) {
          const kept = first.get(r.key);
          if (kept !== undefined) expect(r).toBe(kept);
          else expect(new Set(first.values()).has(r)).toBe(false);
        }
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("a key removed (the list read without it) then added again is a new object", () => {
    const { value } = inScope(() => {
      const list = signal<readonly string[]>(["a", "b"]);
      return {
        list,
        rows: stableRows(
          () => list.get(),
          (k) => k,
        ),
      };
    });
    const a = value.rows.get()[0];
    value.list.set(["b"]);
    expect(value.rows.get().map((r) => r.key)).toEqual(["b"]);
    value.list.set(["a", "b"]);
    expect(value.rows.get()[0]).not.toBe(a);
  });
});
