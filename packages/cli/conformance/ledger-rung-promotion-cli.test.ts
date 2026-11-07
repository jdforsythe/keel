// Spec: k.testing, clause "An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`."
// Spec: k.testing, Ledger "`probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed."
// The real `keel` binary over a temp project (OS tmpdir): `keel test` runs the project's tests (they pass), then
// `keel ledger` rungs the export from those same test files. Property seed: 1337 (in the fixture).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXAMPLE, ITEM, PROPERTY, SEEDED_100, SOURCE, exampleTest, propertyTest, source } from "./ledger-fixture.ts";
import {
  type CliRecord,
  type Run,
  keel,
  makeProject,
  removeFile,
  removeProject,
  summaryOf,
  writeFiles,
} from "./test-sim-project.ts";

let dir = "";
beforeAll(() => {
  dir = makeProject("ledger-rung", { [SOURCE]: source, [EXAMPLE]: exampleTest });
});
afterAll(() => {
  removeProject(dir);
});

const recordOf = (run: Run): CliRecord | undefined => run.records.find((r) => r.kind === "ledger" && r.item === ITEM);

describe("k.testing: `keel ledger` promotes example -> probabilistic on a real project", () => {
  it("an export tested only by examples is `example` after a passing `keel test`", () => {
    const tested = keel(dir, ["test"]);
    expect(tested.status).toBe(0);
    expect(summaryOf(tested)).toMatchObject({ ok: true, counts: { tests: 1, failed: 0 } });
    const led = keel(dir, ["ledger"]);
    expect(led.status).toBe(0);
    expect(recordOf(led)).toEqual({ kind: "ledger", item: ITEM, rung: "example", evidence: `example ${EXAMPLE}` });
  }, 120_000);

  it("adding a passing seeded 100-run property makes it `probabilistic`, evidence listing runs and seed", () => {
    writeFiles(dir, { [PROPERTY]: propertyTest(SEEDED_100) });
    const tested = keel(dir, ["test"]);
    expect(tested.status).toBe(0);
    expect(summaryOf(tested)).toMatchObject({ ok: true, counts: { tests: 2, failed: 0 } });
    const led = keel(dir, ["ledger"]);
    expect(led.status).toBe(0);
    expect(recordOf(led)).toEqual({
      kind: "ledger",
      item: ITEM,
      rung: "probabilistic",
      evidence: `property runs 100 seed 1337 ${PROPERTY} +1`,
    });
  }, 120_000);

  it.each([
    ["99 runs", "{ numRuns: 99, seed: 1337 }"],
    ["no seed", "{ numRuns: 100 }"],
  ])(
    "a property with %s does not reach `probabilistic`: the export stays `example`",
    (_label, options) => {
      writeFiles(dir, { [PROPERTY]: propertyTest(options) });
      expect(recordOf(keel(dir, ["ledger"]))?.rung).toBe("example");
      removeFile(dir, PROPERTY);
    },
    60_000,
  );
});
