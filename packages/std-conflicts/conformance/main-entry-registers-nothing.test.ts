import { rules } from "@keel/check";
// Spec: std.conflicts, clause "With only `@keel/std-conflicts` imported, `respond(raceRecords(...))` (`@keel/cli/testing`) yields E1054 and `rules()` lists neither E2701 nor W2702; after `import('@keel/std-conflicts/tools')` it prints the compact lines, `rules()` lists both and a second `formatter('conflicts.race', ...)` throws E1053."
// Seed 1337
// The formatter and rule registries are process-wide and vitest isolates per file: this file must not import the tools entry at top.
import { formatter } from "@keel/cli";
import { respond } from "@keel/cli/testing";
import { s } from "@keel/schema";
import { raceRecords } from "@keel/std-conflicts";
import fc from "fast-check";
import { expect, test } from "vitest";
import { STORE_ID, boardStores, snapshotOf, racesInRoot } from "./fixtures.ts";

const TOOLS = "@keel/std-conflicts/tools";
const PATH = "group.json";
const lines = (stdout: string) => stdout.split("\n").filter((l) => l !== "");

/** `n` plain edits then one rebased edit from head 1: one order race against all `n`. */
const raceOf = (n: number) => {
  const ops = [
    { t: "add" as const, id: "x", title: "x" },
    ...Array.from({ length: n }, (_, i) => ({ t: "edit" as const, id: "x", title: `t${i}`, base: i + 1 })),
    { t: "edit" as const, id: "x", title: "last", base: 1 },
  ];
  const snap = snapshotOf({}, ops);
  return raceRecords(PATH, racesInRoot(snap, boardStores()), { [STORE_ID]: snap });
};

const listed = (code: string): boolean => JSON.stringify(rules()).includes(code);

test("With only `@keel/std-conflicts` imported, `respond(raceRecords(...))` yields E1054 and `rules()` lists neither E2701 nor W2702; after `import('@keel/std-conflicts/tools')` it prints the compact lines, `rules()` lists both and a second `formatter('conflicts.race', ...)` throws E1053.", async () => {
  // seed 1337
  expect(listed("E2701")).toBe(false);
  expect(listed("W2702")).toBe(false);
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 6 }), (n) => {
      expect(respond(raceOf(n)).stdout).toContain("E1054");
    }),
    { seed: 1337, numRuns: 10 },
  );
  await import(/* @vite-ignore */ TOOLS);
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 6 }), (n) => {
      const r = respond(raceOf(n), { format: "compact" });
      expect(r.stdout).not.toContain("E1054");
      const shown = Array.from({ length: Math.min(n, 2) }, (_, i) => `api.editTodo #${i + 2}`).join(", ");
      const more = n > 2 ? ` +${n - 2}` : "";
      expect(lines(r.stdout)).toEqual([
        `E2701 ${PATH}:1:1 race api.editTodo #${n + 2} over ${shown}${more} on ${STORE_ID}`,
      ]);
    }),
    { seed: 1337, numRuns: 10 },
  );
  expect(listed("E2701")).toBe(true);
  expect(listed("W2702")).toBe(true);
  expect(() => formatter("conflicts.race", { schema: s.object({}), compact: () => "", pretty: () => "" })).toThrow(
    /E1053/,
  );
});
