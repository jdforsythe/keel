// Spec: k.ledger, clause "A report whose package score is below its `thresholds.break`, or whose `thresholds.break` is below the committed threshold, makes `--diff` report E1713."
// Spec: k.ledger, Rules "E1713 `--diff`: a package's score over fresh claims is below its threshold, or its threshold is below the committed one".
// The real `keel` binary over a temp project (OS tmpdir). The mutation report is hand-written JSON in Stryker's shape;
// Stryker never runs. The committed ledger is stored by `keel ledger --write` from a report at 100% with break 70.
// Seed: 1337 (no property in this file).
import { describe, expect, it } from "vitest";
import { EXAMPLE, SOURCE, exampleTest, source } from "./ledger-fixture.ts";
import { PKG_REPORT, diags, mutantsOf, mutationReport, withProject } from "./ledger-fixture-kinds.ts";
import { keel, summaryOf, writeFiles } from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
const REPORT_FILE = "src/clamp.ts";

const report = (killed: number, survived: number, breakAt: number): string =>
  mutationReport(
    { [REPORT_FILE]: { source, statuses: mutantsOf(killed, survived) } },
    { high: 90, low: 80, break: breakAt },
  );

const files = { [SOURCE]: source, [EXAMPLE]: exampleTest, [PKG_REPORT]: report(4, 0, 70) };

const diffAfter = (replacement: string | undefined) =>
  withProject("ledger-e1713", files, (dir) => {
    expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
    if (replacement !== undefined) writeFiles(dir, { [PKG_REPORT]: replacement });
    return keel(dir, ["ledger", "--diff"]);
  });

describe("k.ledger: `keel ledger --diff` and mutation thresholds (E1713)", () => {
  it("A report whose package score is below its `thresholds.break`, or whose `thresholds.break` is below the committed threshold, makes `--diff` report E1713.", () => {
    const belowBreak = diffAfter(report(3, 1, 80));
    expect(belowBreak.status).toBe(1);
    expect(diags(belowBreak, "E1713")).toHaveLength(1);
    expect(summaryOf(belowBreak)).toMatchObject({ ok: false });

    const loweredThreshold = diffAfter(report(4, 0, 60));
    expect(loweredThreshold.status).toBe(1);
    expect(diags(loweredThreshold, "E1713")).toHaveLength(1);
  }, 120_000);

  it("a report unchanged from the committed one gives no E1713", () => {
    const diff = diffAfter(undefined);
    expect(diags(diff, "E1713")).toEqual([]);
    expect(diff.status).toBe(0);
  }, 60_000);

  it("a score at or above `thresholds.break` with an unchanged threshold gives no E1713", () => {
    const diff = diffAfter(report(3, 1, 70));
    expect(diags(diff, "E1713")).toEqual([]);
  }, 60_000);

  it("a raised `thresholds.break` that the score still meets gives no E1713", () => {
    const diff = diffAfter(report(4, 0, 90));
    expect(diags(diff, "E1713")).toEqual([]);
  }, 60_000);
});
