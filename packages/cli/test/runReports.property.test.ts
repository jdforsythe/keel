// k.ledger-items Run evidence and Projects: `runReports` over in-memory reports, `ledgerProjects` and `projectOf`.
import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ledgerProjects } from "../src/internal/ledgerProjects.ts";
import { projectOf } from "../src/internal/projectOf.ts";
import { runReports } from "../src/internal/runReports.ts";

const FC = { seed: 1337, numRuns: 100 };
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const SOURCE = 'import { it } from "vitest";\nit("a", () => {\n  1;\n});\n';
const state = fc.constantFrom("passed", "failed", "skipped");
const report = (entries: Record<string, { sha: string; tests: { line: number; state: string }[] }>): string =>
  JSON.stringify({ v: 1, files: entries });

describe("runReports", () => {
  it("property: a test passes exactly when its file's one fresh entry has a passed and no failed line in its span", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 1, max: 8 }), state), { maxLength: 6 }), (tests) => {
        const files = [
          { path: "packages/p/package.json", source: "{}" },
          { path: "packages/p/test/a.test.ts", source: SOURCE },
          {
            path: "packages/p/reports/tests/run.json",
            source: report({
              "test/a.test.ts": { sha: sha(SOURCE), tests: tests.map(([line, s]) => ({ line, state: s })) },
            }),
          },
        ];
        const runs = runReports(files, ledgerProjects(files), ["packages/p/test/a.test.ts"]);
        const inSpan = tests.filter(([line]) => line >= 2 && line <= 4).map(([, s]) => s);
        expect(runs.passes("packages/p/test/a.test.ts", 2, 4)).toBe(
          inSpan.includes("passed") && !inSpan.includes("failed"),
        );
        expect(runs.diags).toEqual([]);
      }),
      FC,
    );
  });

  it("a missing, stale or doubled entry is no evidence and one W1733 per project naming the count and the first file", () => {
    const tests = [{ line: 2, state: "passed" }];
    const files = [
      { path: "packages/p/package.json", source: "{}" },
      { path: "packages/p/test/a.test.ts", source: SOURCE },
      { path: "packages/p/test/b.test.ts", source: SOURCE },
      { path: "packages/p/test/c.test.ts", source: SOURCE },
      {
        path: "packages/p/reports/tests/1-of-2.json",
        source: report({ "test/b.test.ts": { sha: "0", tests }, "test/c.test.ts": { sha: sha(SOURCE), tests } }),
      },
      {
        path: "packages/p/reports/tests/2-of-2.json",
        source: report({ "test/c.test.ts": { sha: sha(SOURCE), tests } }),
      },
    ];
    const paths = ["a", "b", "c"].map((n) => `packages/p/test/${n}.test.ts`);
    const runs = runReports(files, ledgerProjects(files), paths);
    for (const p of paths) expect(runs.passes(p, 1, 9)).toBe(false);
    expect(runs.diags).toEqual([
      expect.objectContaining({
        code: "W1733",
        path: "packages/p/reports/tests/",
        message: "no usable run report for 3 test files; first test/a.test.ts",
      }),
    ]);
  });

  it("a root report's entry for a package's file is not that package's", () => {
    const tests = [{ line: 2, state: "passed" }];
    const files = [
      { path: "packages/p/package.json", source: "{}" },
      { path: "packages/p/test/a.test.ts", source: SOURCE },
      { path: "reports/tests/run.json", source: report({ "packages/p/test/a.test.ts": { sha: sha(SOURCE), tests } }) },
    ];
    const runs = runReports(files, ledgerProjects(files), ["packages/p/test/a.test.ts"]);
    expect(runs.passes("packages/p/test/a.test.ts", 1, 9)).toBe(false);
    expect(runs.diags.map((d) => d.path)).toEqual(["packages/p/reports/tests/"]);
  });

  it("a report of another shape holds nothing", () => {
    const files = [
      { path: "test/a.test.ts", source: SOURCE },
      { path: "reports/tests/run.json", source: "{" },
    ];
    expect(runReports(files, ["."], ["test/a.test.ts"]).diags.map((d) => d.path)).toEqual(["reports/tests/"]);
  });
});

describe("ledgerProjects and projectOf", () => {
  it("property: the projects are `.` and each named folder with a package.json, and a path belongs to the one holding it", () => {
    const name = fc.stringMatching(/^[a-z]{1,5}$/);
    const group = fc.constantFrom("packages", "apps", "examples", "libraries");
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.tuple(group, name), { maxLength: 5, selector: ([g, n]) => `${g}/${n}` }),
        (dirs) => {
          const files = dirs.map(([g, n]) => ({ path: `${g}/${n}/package.json`, source: "{}" }));
          const projects = ledgerProjects(files);
          const named = dirs.filter(([g]) => g !== "libraries").map(([g, n]) => `${g}/${n}`);
          expect(projects).toEqual([".", ...named.sort()]);
          for (const d of named) expect(projectOf(`${d}/test/x.test.ts`, projects)).toBe(d);
          expect(projectOf("test/x.test.ts", projects)).toBe(".");
        },
      ),
      FC,
    );
  });
});
