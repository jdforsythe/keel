// Spec: k.derived, clause "On `apps/household`, 5 runs of each case of the Time paragraph, scaled as the repository's test times are (`docs/TESTING.md`), each stay within its bound."
// Seed 1337 n/a: no generated input. Method (docs/TESTING.md Time scale): each bound is a time the clause states, so it goes through `testTime`; the work bounded is the binary's own.
// A duration is read as a difference inside one run of the case, with the two commands run back to back on the same tree and machine, so a load that slows both
// leaves the difference: the clause says what is added, not what the whole check takes.
// ASSUMED (the Time paragraph names no baseline for "adds at most 100 ms"): the baseline is a warm `keel check --frozen` of the same unchanged tree, which derives
// and compares every view and writes none; the refresh is the difference an unfrozen warm `keel check` adds to it.
// Edits: a comment appended to `modules/setup/setup.contract.ts` (a file the evaluation loaded) and to `test/spendOf.test.ts` (a file it did not load); neither changes a view.
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Tree, brief, cloneTree, dropTree, householdTree, keel, nowMs, put, read } from "./derived-support.ts";

const SLOW = fixedTime(600_000);
const RUNS = 5;
const LOADED = "modules/setup/setup.contract.ts";
const NOT_LOADED = "test/spendOf.test.ts";

let t: Tree;
let source: Tree;
beforeAll(() => {
  source = householdTree();
  t = cloneTree(source);
  const warm = keel(t.dir, ["check"]);
  if (warm.status !== 0) throw new Error(`warm-up check failed: ${brief(warm)}`);
}, SLOW);
afterAll(() => {
  dropTree(t);
  dropTree(source);
});

/** Milliseconds `keel <args>` takes in the tree, on the monotonic clock; the run must exit 0. */
function timed(args: string[]): number {
  const start = nowMs();
  const out = keel(t.dir, args);
  const ms = nowMs() - start;
  expect(out.status, brief(out)).toBe(0);
  return ms;
}

describe("k.derived Time", () => {
  test(
    "On `apps/household`, 5 runs of each case of the Time paragraph, scaled as the repository's test times are (`docs/TESTING.md`), each stay within its bound." +
      " (the refresh adds at most 100 ms to a warm keel check)",
    () => {
      const bound = testTime(100);
      for (let i = 0; i < RUNS; i++) {
        timed(["check"]);
        const frozen = timed(["check", "--frozen"]);
        const refreshing = timed(["check"]);
        expect(
          refreshing - frozen,
          `run ${String(i + 1)}: ${String(refreshing)} ms against ${String(frozen)} ms frozen`,
        ).toBeLessThanOrEqual(bound);
      }
    },
    SLOW,
  );

  test(
    "On `apps/household`, 5 runs of each case of the Time paragraph, scaled as the repository's test times are (`docs/TESTING.md`), each stay within its bound." +
      " (after an edit to a file the evaluation loaded, a warm keel check takes at most 1.5 s more than after one to a file it did not load)",
    () => {
      const bound = testTime(1_500);
      for (let i = 0; i < RUNS; i++) {
        put(t.dir, NOT_LOADED, `${read(t.dir, NOT_LOADED)}// edit ${String(i)}\n`);
        const quiet = timed(["check"]);
        put(t.dir, LOADED, `${read(t.dir, LOADED)}// edit ${String(i)}\n`);
        const loud = timed(["check"]);
        expect(
          loud - quiet,
          `run ${String(i + 1)}: ${String(loud)} ms against ${String(quiet)} ms`,
        ).toBeLessThanOrEqual(bound);
      }
    },
    SLOW,
  );
});
