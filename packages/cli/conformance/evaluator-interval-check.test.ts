// Spec: k.evaluator, clause "In `G` with `index.mjs` holding `setInterval(() => {}, 1000); export default 1`, `keel check` exits with the code and stdout of the same tree without the `setInterval` call."
// Also states, k.evaluator End: "When the result arrives the command ends the evaluator with a signal no code in it handles: a timer, interval, listener or handle the code left ends with it, runs nothing after the result, and is no diagnostic."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case (`G` of k.evaluator Conformance; evaluator-support.ts `gFixture`).
// "Exits with its result within the bound" is read as: a `keel check` of the tree with a leftover interval takes no more than 20 s longer than the one without it (the evaluator's own deadline is 30 s, which an evaluation waiting on the interval would reach and report as E1048); each run is killed by the test at its bound.
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { type Tree, brief, cloneTree, dropTree, householdTree, nowMs } from "./derived-support.ts";
import { gFixture, keelBounded, recordsOf } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const RUN = 60_000;

let house: Tree | undefined;
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

describe("k.evaluator: a leftover interval ends with the evaluator", () => {
  test(
    "in `G` with `index.mjs` holding `setInterval(() => {}, 1000); export default 1`, `keel check` exits with the code and stdout of the same tree without the `setInterval` call",
    () => {
      const withInterval = copy();
      gFixture(withInterval, "setInterval(() => {}, 1000); export default 1");
      const without = copy();
      gFixture(without, "export default 1");
      const a = keelBounded(withInterval.dir, ["check"], RUN);
      const b = keelBounded(without.dir, ["check"], RUN);
      expect(a.status, brief(a)).not.toBeNull();
      expect(a.status, brief(a)).toBe(b.status);
      expect(a.stdout).toBe(b.stdout);
      expect(recordsOf(a, "E1048"), brief(a)).toEqual([]);
    },
    SLOW,
  );

  test(
    "`keel check` of the tree with a leftover `setInterval` exits with its result within the bound the evaluator's deadline gives: no E1048, and no 20 s more than the same tree without it",
    () => {
      const withInterval = copy();
      gFixture(withInterval, "setInterval(() => {}, 1000); export default 1");
      const without = copy();
      gFixture(without, "export default 1");
      const t0 = nowMs();
      const a = keelBounded(withInterval.dir, ["check"], RUN);
      const tA = nowMs() - t0;
      const t1 = nowMs();
      keelBounded(without.dir, ["check"], RUN);
      const tB = nowMs() - t1;
      expect(a.status, brief(a)).not.toBeNull();
      expect(recordsOf(a, "E1048"), brief(a)).toEqual([]);
      expect(tA - tB, `${String(tA)} ms against ${String(tB)} ms`).toBeLessThan(20_000);
    },
    SLOW,
  );
});
