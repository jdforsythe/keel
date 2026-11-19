// Spec: k.ledger, clause "From a report whose sources match the tree, `keel ledger --write` stores one claim per mutated file with Stryker's counts, and the package score over them; after one file changes, its claim is stale (W1714) and the package score omits it."
// Spec: k.ledger, Rules "W1714 a mutation claim is stale (its file changed since the run)".
// The real `keel` binary over a temp project (OS tmpdir). The mutation report is hand-written JSON in Stryker's shape;
// Stryker never runs. Report keys are paths relative to the package, as Stryker writes them. Seed: 1337 (no property here).
import { describe, expect, it } from "vitest";
import { SOURCE, source } from "./ledger-fixture.ts";
import {
  BOUND_FILE,
  CLAMP_FILE,
  PKG_REPORT,
  boundSource,
  collect,
  diags,
  mutantsOf,
  mutationReport,
  percent,
  readJson,
  sha256,
  withProject,
} from "./ledger-fixture-kinds.ts";
import { keel, summaryOf, writeFiles } from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
// clamp.ts: 3 killed, 1 survived, 1 no coverage = 3/5 = 60%. bound.ts: 2 killed, 2 survived = 2/4 = 50%.
const report = mutationReport(
  {
    "src/clamp.ts": { source, statuses: mutantsOf(3, 1, 1) },
    "src/bound.ts": { source: boundSource, statuses: mutantsOf(2, 2) },
  },
  { high: 90, low: 80, break: 40 },
);
const files = { [SOURCE]: source, [BOUND_FILE]: boundSource, [PKG_REPORT]: report };
const changed = `${source}// edited after the mutation run\n`;

const claimsIn = (dir: string) =>
  collect(readJson(dir, COMMITTED), ["file", "sha", "killed", "survived", "noCoverage", "score"]);
const packageScores = (dir: string) => collect(readJson(dir, COMMITTED), ["score", "threshold"]);

describe("k.ledger: mutation claims from a Stryker report", () => {
  it("From a report whose sources match the tree, `keel ledger --write` stores one claim per mutated file with Stryker's counts, and the package score over them; after one file changes, its claim is stale (W1714) and the package score omits it.", () => {
    withProject("ledger-mutation", files, (dir) => {
      const written = keel(dir, ["ledger", "--write", COMMITTED]);
      expect(written.status).toBe(0);

      const claims = claimsIn(dir);
      expect(claims).toHaveLength(2);
      const clamp = claims.find((c) => c.file === CLAMP_FILE);
      const bound = claims.find((c) => c.file === BOUND_FILE);
      expect(clamp).toMatchObject({ sha: sha256(source), killed: 3, survived: 1, noCoverage: 1 });
      expect(bound).toMatchObject({ sha: sha256(boundSource), killed: 2, survived: 2, noCoverage: 0 });
      expect(percent(clamp?.score)).toBeCloseTo(60);
      expect(percent(bound?.score)).toBeCloseTo(50);
      // The package score is over the fresh claims: (3 + 2) detected over (3 + 2 + 1 + 1 + 2) = 5/9.
      expect(packageScores(dir).map((p) => percent(p.score))).toEqual([expect.closeTo(100 * (5 / 9))]);
      expect(diags(written, "W1714")).toEqual([]);

      writeFiles(dir, { [SOURCE]: changed });
      const stale = keel(dir, ["ledger", "--write", COMMITTED]);
      expect(diags(stale, "W1714")).toHaveLength(1);
      expect(summaryOf(stale)).toMatchObject({ counts: { stale: 1 } });
      expect(packageScores(dir).map((p) => percent(p.score))).toEqual([expect.closeTo(50)]);
      expect(claimsIn(dir).find((c) => c.file === CLAMP_FILE)).toMatchObject({ sha: sha256(source) });
    });
  }, 120_000);

  it("`keel ledger` emits one `ledger.mutation` record per claim with its score, survivors and freshness", () => {
    const run = withProject("ledger-mutation-records", files, (dir) => keel(dir, ["ledger"]));
    const records = run.records.filter((r) => r.kind === "ledger.mutation");
    expect(records).toHaveLength(2);
    const clamp = records.find((r) => r.file === CLAMP_FILE);
    expect(clamp).toMatchObject({ kind: "ledger.mutation", survived: 1, fresh: true });
    expect(percent(clamp?.score)).toBeCloseTo(60);
  }, 60_000);

  it("a file changed since the run has a `ledger.mutation` record with `fresh: false` and a W1714 diagnostic", () => {
    const run = withProject("ledger-mutation-stale", files, (dir) => {
      writeFiles(dir, { [SOURCE]: changed });
      return keel(dir, ["ledger"]);
    });
    const clamp = run.records.find((r) => r.kind === "ledger.mutation" && r.file === CLAMP_FILE);
    expect(clamp).toMatchObject({ fresh: false });
    expect(diags(run, "W1714")).toHaveLength(1);
    expect(summaryOf(run)).toMatchObject({ counts: { stale: 1 } });
  }, 60_000);

  it("a report on disk replaces the claims of the files it covers and other claims are kept", () => {
    withProject("ledger-mutation-merge", files, (dir) => {
      expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
      const onlyBound = mutationReport(
        { "src/bound.ts": { source: boundSource, statuses: mutantsOf(4, 0) } },
        { high: 90, low: 80, break: 40 },
      );
      writeFiles(dir, { [PKG_REPORT]: onlyBound });
      expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
      const claims = claimsIn(dir);
      expect(claims.find((c) => c.file === BOUND_FILE)).toMatchObject({ killed: 4, survived: 0 });
      expect(claims.find((c) => c.file === CLAMP_FILE)).toMatchObject({ killed: 3, survived: 1, noCoverage: 1 });
    });
  }, 120_000);
});
