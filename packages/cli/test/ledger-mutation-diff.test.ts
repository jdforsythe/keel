// `keel ledger --diff` and mutation claims (k.ledger Mutation): a package whose every claim is stale is E1713.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ledgerRun as run } from "./ledgerRun.ts";

const CWD = "/work/app";
const file = (path: string, source: string) => ({ path, source });
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const committed = (source: string) =>
  file(
    "tooling/ledger/ledger.json",
    JSON.stringify({
      version: 1,
      unsafe: 0,
      hostElements: 0,
      mutation: {
        projects: { "packages/a": { score: 100, threshold: 70 } },
        claims: [{ file: "packages/a/src/a.ts", sha: sha(source), killed: 3, survived: 0, noCoverage: 0, score: 100 }],
      },
      exports: [],
      clauses: [],
    }),
  );
const codes = async (files: { path: string; source: string }[]): Promise<string[]> => {
  const r = await run(["ledger", "--diff", "--format=json"], { cwd: CWD, files });
  return r.stdout
    .split("\n")
    .filter((l) => l !== "")
    .map((l): unknown => JSON.parse(l))
    .flatMap((x) => (typeof x === "object" && x !== null && "code" in x && typeof x.code === "string" ? [x.code] : []));
};

describe("ledger --diff: stale claims", () => {
  it("a package whose every claim is stale is E1713 beside the W1714; one fresh claim at 100% is not", async () => {
    expect(await codes([committed("old"), file("packages/a/src/a.ts", "new")])).toEqual(["W1714", "E1713"]);
    expect(await codes([committed("same"), file("packages/a/src/a.ts", "same")])).toEqual([]);
  });

  it("a file the report holds with only ignored mutants loses its claim: no W1714, as mutate-stale leaves it alone", async () => {
    const report = (source: string, status: string) =>
      file(
        "packages/a/reports/mutation/mutation.json",
        JSON.stringify({
          thresholds: { break: 70 },
          files: { "src/a.ts": { source, mutants: [{ status, mutatorName: "X", replacement: "y" }] } },
        }),
      );
    const ignored = [committed("old"), file("packages/a/src/a.ts", "new"), report("new", "Ignored")];
    expect(await codes(ignored)).not.toContain("W1714");
    // a report with a scored mutant replaces the claim instead
    expect(await codes([committed("old"), file("packages/a/src/a.ts", "new"), report("new", "Killed")])).toEqual([]);
  });
});
