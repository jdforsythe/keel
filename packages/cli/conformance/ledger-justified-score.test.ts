// Spec: k.ledger, clause "From a report with one Survived mutant and a `mutation-justified.json` entry naming its file, mutator, original and replacement, `keel ledger --write` stores that file's claim with `justified` 1 and the package's `scoreJustified` above its `score`, and `--diff` judges the threshold on `score`."
// The real `keel` binary over a temp project (OS tmpdir); the report and justified file are hand-written JSON. Seed: 1337 (no property here).
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { PKG_REPORT, collect, diags, percent, readJson, withProject } from "./ledger-fixture-kinds.ts";
import { EXAMPLE, SOURCE, exampleTest, source } from "./ledger-fixture.ts";
import { JUSTIFIED_FILE, entry, justifiedFile, justifiedReport } from "./ledger-justified-fixture.ts";
import { keel, writeFiles } from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
// 3 killed + 1 survived = 75%; with the survivor justified and left out of the count, 100%.
const report = (breakAt: number): string => justifiedReport("Survived", 3, { high: 90, low: 80, break: breakAt });
const files = {
  [SOURCE]: source,
  [EXAMPLE]: exampleTest,
  [PKG_REPORT]: report(70),
  [JUSTIFIED_FILE]: justifiedFile([entry()]),
};

describe("k.ledger: justified survivors", () => {
  it(
    "From a report with one Survived mutant and a `mutation-justified.json` entry naming its file, mutator, original and replacement, `keel ledger --write` stores that file's claim with `justified` 1 and the package's `scoreJustified` above its `score`, and `--diff` judges the threshold on `score`.",
    () => {
      withProject("ledger-justified", files, (dir) => {
        const written = keel(dir, ["ledger", "--write", COMMITTED]);
        expect(written.status).toBe(0);
        expect(diags(written, "E1725")).toEqual([]);

        const ledger = readJson(dir, COMMITTED);
        const claims = collect(ledger, ["file", "sha", "killed", "survived", "noCoverage", "justified"]);
        expect(claims).toHaveLength(1);
        expect(claims[0]).toMatchObject({ killed: 3, survived: 1, noCoverage: 0, justified: 1 });
        const pkgs = collect(ledger, ["score", "scoreJustified", "threshold", "justified"]);
        expect(pkgs).toHaveLength(1);
        expect(percent(pkgs[0]?.score)).toBeCloseTo(75);
        expect(percent(pkgs[0]?.scoreJustified)).toBeGreaterThan(75);
        expect(pkgs[0]).toMatchObject({ killed: 3, survived: 1, noCoverage: 0, justified: 1 });

        // Unchanged: no E1713 either way.
        expect(diags(keel(dir, ["ledger", "--diff"]), "E1713")).toEqual([]);

        // Threshold above `score` (75) but below `scoreJustified` (100): E1713 still fires, so the justification does not lift the package.
        writeFiles(dir, { [PKG_REPORT]: report(80) });
        const diff = keel(dir, ["ledger", "--diff"]);
        expect(diags(diff, "E1713")).toHaveLength(1);
        expect(diff.status).toBe(1);
      });
    },
    fixedTime(120_000),
  );

  it(
    "a package with no `mutation-justified.json` has `justified` 0 and `scoreJustified` equal to `score`",
    () => {
      const { [JUSTIFIED_FILE]: _none, ...bare } = files;
      withProject("ledger-justified-none", bare, (dir) => {
        expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
        const pkgs = collect(readJson(dir, COMMITTED), ["score", "scoreJustified", "justified"]);
        expect(pkgs[0]).toMatchObject({ justified: 0 });
        expect(percent(pkgs[0]?.scoreJustified)).toBeCloseTo(percent(pkgs[0]?.score));
      });
    },
    fixedTime(60_000),
  );
});
