// Spec: k.evidence, Conformance "In a fixture with no `spec/` and no conformance files, each `pii.json` sink carries the rung `@keel/cli` ships for its clause, and `coverage` is 1 when those are all `probabilistic` or higher."
// Seed: 1337.
// Skipped until `pii.json` falls back to the kernel ledger `@keel/cli` ships.
// ASSUMED (the spec names no field): an object of `pii.json` that names a sink clause (`std.sessions#2`, ...) holds its
// rung as a string value that is one of the ledger's rung names. The shipped rung of each clause is not read from the
// package: the test requires `probabilistic` or higher, which is what the clause's `coverage` of 1 means.
import { rmSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import {
  SINK_CLAUSES,
  TEST_KEY_PEM,
  fixtureTree,
  parseJson,
  project,
  readTree,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 600_000;
const cleanups: string[] = [];
afterAll(() => {
  for (const d of cleanups) rmSync(d, { recursive: true, force: true });
});

const RUNGS = ["proven", "exhaustive", "probabilistic", "example", "monitored", "none"] as const;
const AT_LEAST_PROBABILISTIC: readonly string[] = ["proven", "exhaustive", "probabilistic"];

/** The fixture without `spec/` and without any conformance file. */
const bare = () =>
  Object.fromEntries(
    Object.entries(fixtureTree()).filter(([path]) => !path.startsWith("spec/") && !path.includes("/conformance/")),
  );

const piiOf = (out: string): unknown => parseJson(readTree(out).get("pii.json"));

/** The rung names held as direct string values of every object that also names `clause` as a string value. */
function rungsOf(value: unknown, clause: string): string[] {
  const found: string[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    if (typeof v !== "object" || v === null) return;
    const values = Object.values(v);
    if (values.some((x) => x === clause)) {
      for (const x of values) if (typeof x === "string" && RUNGS.some((r) => r === x)) found.push(x);
    }
    for (const x of values) visit(x);
  };
  visit(value);
  return found;
}

describe("k.evidence: shipped sink rungs", () => {
  test.skip(
    "in a fixture with no `spec/` and no conformance files, each `pii.json` sink carries the rung `@keel/cli` ships for its clause",
    () => {
      const dir = project(bare());
      const { out, base, run } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      expect(run.status).toBe(0);
      const pii = piiOf(out);
      for (const c of SINK_CLAUSES) {
        const rungs = rungsOf(pii, c.id);
        expect(rungs.length, c.id).toBeGreaterThan(0);
        for (const r of rungs) expect(RUNGS, c.id).toContain(r);
        expect(
          rungs.every((r) => r === rungs[0]),
          c.id,
        ).toBe(true);
      }
    },
    SLOW,
  );

  test.skip(
    "`coverage` is 1 when the shipped rungs are all `probabilistic` or higher",
    () => {
      const dir = project(bare());
      const { out, base } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      const pii = piiOf(out);
      for (const c of SINK_CLAUSES) {
        for (const r of rungsOf(pii, c.id)) expect(AT_LEAST_PROBABILISTIC, c.id).toContain(r);
      }
      expect(typeof pii === "object" && pii !== null && "coverage" in pii ? pii.coverage : undefined).toBe(1);
    },
    SLOW,
  );

  test.skip(
    "the project ledger's rung wins when it holds the item: the same fixture with its spec and an example-only citation reports `example` for that clause",
    () => {
      const lowered = SINK_CLAUSES[0];
      const dir = project(
        fixtureTree({ probabilisticSinks: SINK_CLAUSES.filter((c) => c.id !== lowered.id).map((c) => c.id) }),
      );
      const { out, base } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      const rungs = rungsOf(piiOf(out), lowered.id);
      expect(rungs.length).toBeGreaterThan(0);
      expect(rungs.every((r) => r === "example")).toBe(true);
    },
    SLOW,
  );
});
