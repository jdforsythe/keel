// Spec: k.ledger, clause "An entry without `note`, or with a `reason` outside `equivalent`, `unreachable` and `performance`, makes `keel ledger` report E1725 with or without a report on disk."
// k.ledger, Rules "E1725 a package's `mutation-justified.json` fails its shape (a field missing, a reason outside the set, two equal entries)".
// The real `keel` binary over a temp project (OS tmpdir). Seed: 1337 (no property here).
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { PKG_REPORT, diags, withProject } from "./ledger-fixture-kinds.ts";
import { EXAMPLE, SOURCE, exampleTest, source } from "./ledger-fixture.ts";
import { JUSTIFIED_FILE, type Entry, entry, justifiedFile, justifiedReport } from "./ledger-justified-fixture.ts";
import { keel } from "./test-sim-project.ts";

const run = (entries: readonly Entry[], withReport: boolean) =>
  withProject(
    "ledger-e1725-shape",
    {
      [SOURCE]: source,
      [EXAMPLE]: exampleTest,
      ...(withReport ? { [PKG_REPORT]: justifiedReport("Survived", 3, { high: 90, low: 80, break: 50 }) } : {}),
      [JUSTIFIED_FILE]: justifiedFile(entries),
    },
    (dir) => keel(dir, ["ledger"]),
  );

const { note: _note, ...noNote } = entry();

describe("k.ledger: E1725 a justified file that fails its shape", () => {
  it(
    "An entry without `note`, or with a `reason` outside `equivalent`, `unreachable` and `performance`, makes `keel ledger` report E1725 with or without a report on disk.",
    () => {
      for (const withReport of [true, false]) {
        expect(diags(run([noNote], withReport), "E1725")).toHaveLength(1);
        expect(diags(run([entry({ reason: "flaky" })], withReport), "E1725")).toHaveLength(1);
      }
    },
    fixedTime(240_000),
  );

  it(
    "each of `equivalent`, `unreachable` and `performance` is an accepted reason",
    () => {
      for (const reason of ["equivalent", "unreachable", "performance"]) {
        expect(diags(run([entry({ reason })], true), "E1725")).toEqual([]);
      }
    },
    fixedTime(180_000),
  );

  it(
    "an entry missing any other field, or two equal entries, gives E1725",
    () => {
      for (const field of ["file", "mutator", "original", "replacement", "reason"]) {
        const { [field]: _gone, ...rest } = entry();
        expect(diags(run([rest], false), "E1725")).toHaveLength(1);
      }
      expect(diags(run([entry(), entry()], true), "E1725")).toHaveLength(1);
    },
    fixedTime(360_000),
  );

  it(
    "a well-formed file with no report on disk gives no E1725",
    () => {
      expect(diags(run([entry()], false), "E1725")).toEqual([]);
    },
    fixedTime(60_000),
  );
});
