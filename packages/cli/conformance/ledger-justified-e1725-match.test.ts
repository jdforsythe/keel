// Spec: k.ledger, clause "An entry whose texts match only a Killed mutant, or no mutant, of the report on disk makes `keel ledger` report E1725 naming the entry."
// k.ledger, Rules "E1725 a package's `mutation-justified.json` fails its shape (a field missing, a reason outside the set, two equal entries), or, with a report on disk, has an entry that justifies no mutant of it".
// The real `keel` binary over a temp project (OS tmpdir). Seed: 1337 (no property here).
import { describe, expect, it } from "vitest";
import { PKG_REPORT, diags, withProject } from "./ledger-fixture-kinds.ts";
import { EXAMPLE, SOURCE, exampleTest, source } from "./ledger-fixture.ts";
import { JUSTIFIED_FILE, ORIGINAL, entry, justifiedFile, justifiedReport } from "./ledger-justified-fixture.ts";
import { keel } from "./test-sim-project.ts";

const thresholds = { high: 90, low: 80, break: 50 };
const run = (status: "Survived" | "Killed" | "Timeout", entries: Parameters<typeof justifiedFile>[0]) =>
  withProject(
    "ledger-e1725-match",
    {
      [SOURCE]: source,
      [EXAMPLE]: exampleTest,
      [PKG_REPORT]: justifiedReport(status, 3, thresholds),
      [JUSTIFIED_FILE]: justifiedFile(entries),
    },
    (dir) => keel(dir, ["ledger"]),
  );

const named = (r: ReturnType<typeof run>): string => JSON.stringify(diags(r, "E1725"));

describe("k.ledger: E1725 an entry that justifies no mutant", () => {
  it("An entry whose texts match only a Killed mutant, or no mutant, of the report on disk makes `keel ledger` report E1725 naming the entry.", () => {
    const killed = run("Killed", [entry()]);
    expect(diags(killed, "E1725")).toHaveLength(1);
    expect(named(killed)).toContain(ORIGINAL);

    const none = run("Survived", [entry({ original: "Math.floor", replacement: "Math.ceil" })]);
    expect(diags(none, "E1725")).toHaveLength(1);
    expect(named(none)).toContain("Math.floor");

    const timeout = run("Timeout", [entry()]);
    expect(diags(timeout, "E1725")).toHaveLength(1);
  }, 120_000);

  it("an entry that matches a Survived mutant gives no E1725", () => {
    expect(diags(run("Survived", [entry()]), "E1725")).toEqual([]);
  }, 60_000);

  it("an entry that matches a NoCoverage mutant gives no E1725", () => {
    const r = withProject(
      "ledger-e1725-nocov",
      {
        [SOURCE]: source,
        [EXAMPLE]: exampleTest,
        [PKG_REPORT]: justifiedReport("NoCoverage", 3, thresholds),
        [JUSTIFIED_FILE]: justifiedFile([entry()]),
      },
      (dir) => keel(dir, ["ledger"]),
    );
    expect(diags(r, "E1725")).toEqual([]);
  }, 60_000);

  it("an entry that differs from the mutant in one of mutator, original or replacement gives E1725", () => {
    for (const over of [{ mutator: "EqualityOperator" }, { original: "Math.max" }, { replacement: "Math.abs" }]) {
      expect(diags(run("Survived", [entry(over)]), "E1725")).toHaveLength(1);
    }
  }, 180_000);
});
