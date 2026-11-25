// Spec: k.ledger, clause "A passing `simulate` with `runs: 100` and a literal seed makes the exports its scenario names `probabilistic`."
// k.ledger, Ledger "`probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed."
// The real `keel` binary over a temp project (OS tmpdir). `simulate` is @keel/testing's (k.sim); its options are read
// from literals or imported constants. Seed: 1337.
import { describe, expect, it } from "vitest";
import { evidenceText, ledgerRecord, withProject } from "./ledger-fixture-kinds.ts";
import { ITEM, SOURCE, source } from "./ledger-fixture.ts";
import { keel } from "./test-sim-project.ts";

const SIM_TEST = "packages/m/test/clamp-simulate.test.ts";
const RUNS = "packages/m/test/runs.ts";

/** A scenario over `clamp`; `options` is the `simulate` options argument as written (with its leading comma), or "". */
const simTest = (options: string, imports = ""): string => `import { simulate } from "@keel/testing";
import { expect, it } from "vitest";
import { clamp } from "../src/clamp.ts";
${imports}
it("clamp holds under every schedule", async () => {
  await simulate(async ({ run }) => {
    await run();
    expect(clamp(9, 0, 5)).toBe(5);
  }${options});
});
`;

const rungOf = (options: string, imports = "", extra: Record<string, string> = {}) =>
  withProject("ledger-simulate", { [SOURCE]: source, [SIM_TEST]: simTest(options, imports), ...extra }, (dir) =>
    ledgerRecord(keel(dir, ["ledger"]), ITEM),
  );

describe("k.ledger: `simulate` evidence", () => {
  it("A passing `simulate` with `runs: 100` and a literal seed makes the exports its scenario names `probabilistic`.", () => {
    const record = rungOf(", { runs: 100, seed: 1337 }");
    expect(record?.rung).toBe("probabilistic");
    const evidence = evidenceText(record);
    expect(evidence).toContain("100");
    expect(evidence).toContain("1337");
  }, 60_000);

  it("`simulate` with no options defaults to 100 runs and seed 1337 and gives `probabilistic`", () => {
    const record = rungOf("");
    expect(record?.rung).toBe("probabilistic");
    expect(evidenceText(record)).toContain("1337");
  }, 60_000);

  it("`simulate` with fewer than 100 literal runs leaves the export `example`", () => {
    expect(rungOf(", { runs: 99, seed: 1337 }")?.rung).toBe("example");
  }, 60_000);

  it("`simulate` whose `runs` the ledger cannot resolve leaves the export `example`", () => {
    const record = rungOf(", { runs: RUNS, seed: 1337 }", 'import { RUNS } from "./runs.ts";', {
      [RUNS]: "export const RUNS: number = [100][0] ?? 100;\n",
    });
    expect(record?.rung).toBe("example");
  }, 60_000);
});
