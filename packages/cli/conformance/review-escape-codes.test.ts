// Spec: k.escapes, clause "In a fixture git repository each code of the table is reported on its fixture by a range and not on its clean twin; with `--all`, the range codes but R1101 and R1102 are absent."
// Seed: n/a (the table is finite; fixtures in `review-cases.ts`).
// Each case is a base commit and a head commit; the clean twin shares the base and changes only `modules/m/a.ts`. Under `--all`
// the working tree (the head) is read: the range codes R1060, R1061, R1100, R1103, R1104, R1105, R1107, R1108 are absent;
// R1101 and R1102 are read from the tree, so a head that holds them still reports them (k.escapes Range codes).
import { expect, test } from "vitest";
import { CASES, HARMLESS, cleanBase } from "./review-cases.ts";
import { PROJECT, ofCode, range, review, withRepo } from "./review-support.ts";

const RANGE_CODES = ["R1060", "R1061", "R1100", "R1103", "R1104", "R1105", "R1107", "R1108"];

test("In a fixture git repository each code of the table is reported on its fixture by a range and not on its clean twin; with `--all`, the range codes but R1101 and R1102 are absent.", () => {
  expect(new Set(CASES.map((c) => c.code)).size).toBe(28);
});

test.each(CASES.map((c) => [c.code, c] as const))(
  "In a fixture git repository %s is reported on its fixture by a range and not on its clean twin; with `--all`, the range codes but R1101 and R1102 are absent.",
  (_code, c) => {
    withRepo([{ ...PROJECT, ...c.base }, c.head], (repo) => {
      const hits = ofCode(review(repo, [range(repo, 0, 1), "--list"]), c.code);
      expect(hits.length, `${c.code} on its fixture`).toBeGreaterThanOrEqual(1);
      const all = review(repo, ["--all", "--list"]);
      if (RANGE_CODES.includes(c.code)) expect(ofCode(all, c.code), `${c.code} under --all`).toEqual([]);
      if (c.code === "R1101" || c.code === "R1102")
        expect(ofCode(all, c.code).length, `${c.code} under --all`).toBeGreaterThanOrEqual(1);
    });
    withRepo([{ ...PROJECT, ...cleanBase(c) }, HARMLESS], (repo) => {
      expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), c.code), `${c.code} on its clean twin`).toEqual([]);
    });
  },
  120_000,
);
