// Spec: k.evidence, Conformance "A fixture with a failing test still gets a verifying bundle whose `runs` counts it; the command exits 1 with E1060."
// Spec: k.evidence, Rules "E1060 the bundle records a check error or a failed test"
// Seed: 1337. ASSUMED (the spec gives `runs` no key names): `runs` is an object of the check error count and the failed
// test count, so the test sums its numeric values: 0 for the clean fixture, 1 for one failure or one check error.
import { rmSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import {
  TEST_KEY_PEM,
  diagsOf,
  fixtureTree,
  keelEvidence,
  keyOf,
  numbersIn,
  parseJson,
  project,
  readTree,
  sum,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 300_000;
const cleanups: string[] = [];
afterAll(() => {
  for (const d of cleanups) rmSync(d, { recursive: true, force: true });
});

const runsOf = (out: string): unknown => {
  const manifest = parseJson(readTree(out).get("manifest.json"));
  return typeof manifest === "object" && manifest !== null && "runs" in manifest ? manifest.runs : undefined;
};

describe("k.evidence: failing runs", () => {
  test(
    "A fixture with a failing test still gets a verifying bundle whose `runs` counts it",
    () => {
      const dir = project(fixtureTree({ failingTest: true }));
      const { out, base } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      expect(readTree(out).size).toBe(8);
      expect(sum(numbersIn(runsOf(out)))).toBe(1);
      const verified = keelEvidence(dir, ["evidence", "--verify", out]);
      expect(verified.status).toBe(0);
      expect(verified.records.filter((r) => r.kind === "evidence")).toEqual([
        expect.objectContaining({ keyId: keyOf(TEST_KEY_PEM).keyId }),
      ]);
    },
    SLOW,
  );

  test(
    "the command exits 1 with E1060 for a failing test",
    () => {
      const dir = project(fixtureTree({ failingTest: true }));
      const { run, base } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      expect(run.status).toBe(1);
      expect(diagsOf(run, "E1060")).not.toEqual([]);
    },
    SLOW,
  );

  test(
    "E1060 the bundle records a check error: a fixture with one check error is written, counted, and exits 1",
    () => {
      const dir = project(fixtureTree({ checkError: true }));
      const { out, base, run } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      expect(run.status).toBe(1);
      expect(diagsOf(run, "E1060")).not.toEqual([]);
      expect(sum(numbersIn(runsOf(out)))).toBeGreaterThanOrEqual(1);
      expect(keelEvidence(dir, ["evidence", "--verify", out]).status).toBe(0);
    },
    SLOW,
  );

  test(
    "a clean fixture counts nothing in `runs` and raises no E1060",
    () => {
      const dir = project(fixtureTree());
      const { out, base, run } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      expect(diagsOf(run, "E1060")).toEqual([]);
      expect(run.status).toBe(0);
      expect(sum(numbersIn(runsOf(out)))).toBe(0);
    },
    SLOW,
  );
});
