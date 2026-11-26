// Spec: k.ledger-items, clause "In package `p` whose `conformance/a.test.ts` cites `A is one.` with one test from line 3 to line 5: with `packages/p/reports/tests/run.json` holding `conformance/a.test.ts` at the file's `sha` with `{ line: 3, state: 'passed' }`, the clause is `example`; with `failed` or `skipped` in place of `passed`, or `line: 7`, it is `none`; with another `sha`, or no `reports/tests/`, it is `none` and `keel ledger` reports one W1733 at `packages/p/reports/tests/`."
// Spec: k.ledger-items, clause "An `it.each([1, 2])` test whose report holds two tests at its line, one `passed` and one `failed`, gives no evidence; with both `passed` it gives `example`."
// Spec: k.ledger-items, clause "A test file held at its `sha` by both `reports/tests/run.json` and `reports/tests/1-of-2.json` gives no evidence, and `keel ledger` reports one W1733."
// Spec: k.ledger-items, clause "An export of `packages/p/src/f.ts` referenced only by a test its report records `failed` is `none`."
// Seed: 1337 (the one property, 5 runs). Binary runs: 1 per case (`keel ledger`, no report written for the fixture: `reports: "none"`), 2 for the property's run (the report stands again once the file is restored).
// The real `keel` binary over temp projects (OS tmpdir). Package `p` is `packages/p` with a `package.json`; the cited section `k.x` is `spec/kernel/k.x.md`; the file's call is lines 3 to 5.
// The brief's list gives "a report where the test failed" and "a report listing the file but not the test" one W1733 each; k.ledger-items Run evidence gives W1733 for a missing report, a stale
// `sha` and a file held twice only, so a fresh report whose test failed, skipped or sits outside the call is `none` with no W1733 (asserted).
// ASSUMED: W1733's message names the first test file as its path under the project (`conformance/a.test.ts`), the files sorted by path; "the first one" is read as the first in that order.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import {
  type ReportedTest,
  SEED,
  SLOW,
  citeLine,
  citingFile,
  clauseRecord,
  diagsOf,
  inProject,
  itemOf,
  ledgerAsIs,
  packageJson,
  reportText,
  sha256,
  specPath,
  specText,
} from "./ledger-items-support.ts";
import { type Run, makeProject, removeProject, writeFiles } from "./test-sim-project.ts";

const ONE = "A is one.";
const A = "conformance/a.test.ts";
const HEADER = [citeLine("k.x", ONE)];
/** The citing file of k.x: its one test runs from line 3 to line 5. */
const CITING = citingFile(HEADER);
const REPORTS = (p: string): string => `packages/${p}/reports/tests`;
type State = ReportedTest["state"];

/** Package `p` holding section `id` and its citing file, and a report of `tests` at the file's `sha` unless `report` is given. */
const pkg = (
  p: string,
  id: string,
  opts: { tests?: readonly ReportedTest[]; sha?: string; report?: string | null; source?: string } = {},
): Record<string, string> => {
  const source = opts.source ?? citingFile([citeLine(id, ONE)]).source;
  const report =
    opts.report === undefined
      ? reportText({ [A]: { source, tests: opts.tests ?? [{ line: 3, state: "passed" }], sha: opts.sha } })
      : opts.report;
  return {
    [specPath(id)]: specText(id, [ONE]),
    [`packages/${p}/package.json`]: packageJson(p),
    [`packages/${p}/${A}`]: source,
    ...(report === null ? {} : { [`${REPORTS(p)}/run.json`]: report }),
  };
};
const rungOf = (run: Run, id: string): unknown => clauseRecord(run, itemOf(id, ONE))?.rung;
const w1733 = (run: Run) => diagsOf(run, "W1733");

const made: string[] = [];
afterAll(() => {
  for (const d of made) removeProject(d);
});
const project = (prefix: string, files: Record<string, string>): string => {
  const dir = makeProject(prefix, files);
  made.push(dir);
  return dir;
};

describe("k.ledger-items: a test is passing when a run report says so", () => {
  it(
    "with `packages/p/reports/tests/run.json` holding `conformance/a.test.ts` at the file's `sha` with `{ line: 3, state: 'passed' }`, the clause is `example`",
    () => {
      inProject("items-run-pass", pkg("p", "k.x"), (dir) => {
        const run = ledgerAsIs(dir);
        expect(rungOf(run, "k.x")).toBe("example");
        expect(w1733(run)).toEqual([]);
      });
    },
    SLOW,
  );

  it(
    "with `failed` or `skipped` in place of `passed`, or `line: 7`, the clause is `none`, and a fresh report is no W1733",
    () => {
      const cases: [string, ReportedTest][] = [
        ["failed", { line: 3, state: "failed" }],
        ["skipped", { line: 3, state: "skipped" }],
        ["outside", { line: 7, state: "passed" }],
        ["before", { line: 2, state: "passed" }],
      ];
      const files = cases.reduce<Record<string, string>>(
        (acc, [name, t], i) => ({ ...acc, ...pkg(name, `k.s${i}`, { tests: [t] }) }),
        {},
      );
      const run = ledgerAsIs(project("items-run-states", files));
      cases.forEach(([name], i) => expect(rungOf(run, `k.s${i}`), name).toBe("none"));
      expect(w1733(run)).toEqual([]);
    },
    SLOW,
  );

  it(
    "a report line from the first to the last line of the test's call counts and one outside it does not (every line 1 to 8)",
    () => {
      const lines = [1, 2, 3, 4, 5, 6, 7, 8];
      const files = lines.reduce<Record<string, string>>(
        (acc, line) => ({ ...acc, ...pkg(`l${line}`, `k.l${line}`, { tests: [{ line, state: "passed" }] }) }),
        {},
      );
      const run = ledgerAsIs(project("items-run-lines", files));
      for (const line of lines)
        expect(rungOf(run, `k.l${line}`), `line ${line}`).toBe(line >= 3 && line <= 5 ? "example" : "none");
    },
    SLOW,
  );

  it(
    "with another `sha`, the clause is `none` and `keel ledger` reports one W1733 at `packages/p/reports/tests/`",
    () => {
      inProject("items-run-sha", pkg("p", "k.x", { sha: sha256("another source") }), (dir) => {
        const run = ledgerAsIs(dir);
        expect(rungOf(run, "k.x")).toBe("none");
        expect(w1733(run)).toEqual([expect.objectContaining({ path: "packages/p/reports/tests/" })]);
        expect(String(w1733(run)[0]?.message)).toContain(A);
      });
    },
    SLOW,
  );

  it(
    "with no `reports/tests/`, the clause is `none` and `keel ledger` reports one W1733 at `packages/p/reports/tests/`",
    () => {
      inProject("items-run-none", pkg("p", "k.x", { report: null }), (dir) => {
        const run = ledgerAsIs(dir);
        expect(rungOf(run, "k.x")).toBe("none");
        expect(w1733(run)).toEqual([expect.objectContaining({ path: "packages/p/reports/tests/" })]);
      });
    },
    SLOW,
  );

  it(
    "a project with two test files and no report is one W1733 naming 2 test files and the first; each project without a report has its own",
    () => {
      const files = {
        ...pkg("p", "k.x", { report: null }),
        "packages/p/conformance/b.test.ts": citingFile([citeLine("k.x", ONE)]).source,
        ...pkg("q", "k.y", { report: null }),
      };
      const run = ledgerAsIs(project("items-run-count", files));
      const found = w1733(run);
      expect(found.map((d) => d.path).sort()).toEqual(["packages/p/reports/tests/", "packages/q/reports/tests/"]);
      const p = found.find((d) => d.path === "packages/p/reports/tests/");
      expect(String(p?.message)).toContain("2");
      expect(String(p?.message)).toContain("a.test.ts");
    },
    SLOW,
  );

  it(
    "an `it.each([1, 2])` test whose report holds two tests at its line, one `passed` and one `failed`, gives no evidence; with both `passed` it gives `example`",
    () => {
      const source = [
        citeLine("k.m", ONE),
        'import { expect, it } from "vitest";',
        'it.each([1, 2])("holds %i", (n) => {',
        "  expect(n).toBeGreaterThan(0);",
        "});",
        "",
      ].join("\n");
      const mixed: ReportedTest[] = [
        { line: 3, state: "passed" },
        { line: 3, state: "failed" },
      ];
      const both: ReportedTest[] = [
        { line: 3, state: "passed" },
        { line: 3, state: "passed" },
      ];
      const files = {
        ...pkg("m1", "k.m1", { source: source.replace("k.m", "k.m1"), tests: mixed }),
        ...pkg("m2", "k.m2", { source: source.replace("k.m", "k.m2"), tests: both }),
      };
      const run = ledgerAsIs(project("items-run-each", files));
      expect(rungOf(run, "k.m1")).toBe("none");
      expect(rungOf(run, "k.m2")).toBe("example");
    },
    SLOW,
  );

  it(
    "a test file held at its `sha` by both `reports/tests/run.json` and `reports/tests/1-of-2.json` gives no evidence, and `keel ledger` reports one W1733",
    () => {
      const files = {
        ...pkg("p", "k.x"),
        [`${REPORTS("p")}/1-of-2.json`]: reportText({
          [A]: { source: CITING.source, tests: [{ line: 3, state: "passed" }] },
        }),
      };
      // the cited section is k.x and the file cites k.x
      const run = ledgerAsIs(project("items-run-double", files));
      expect(rungOf(run, "k.x")).toBe("none");
      expect(w1733(run)).toEqual([expect.objectContaining({ path: "packages/p/reports/tests/" })]);
    },
    SLOW,
  );

  it(
    "two shard reports that each hold a different test file both stand: no W1733, each file's clause is `example`",
    () => {
      const b = citingFile([citeLine("k.y", ONE)]);
      const a = citingFile([citeLine("k.x", ONE)]);
      const files = {
        [specPath("k.x")]: specText("k.x", [ONE]),
        [specPath("k.y")]: specText("k.y", [ONE]),
        "packages/p/package.json": packageJson("p"),
        "packages/p/conformance/a.test.ts": a.source,
        "packages/p/conformance/b.test.ts": b.source,
        [`${REPORTS("p")}/1-of-2.json`]: reportText({
          [A]: { source: a.source, tests: [{ line: 3, state: "passed" }] },
        }),
        [`${REPORTS("p")}/2-of-2.json`]: reportText({
          "conformance/b.test.ts": { source: b.source, tests: [{ line: 3, state: "passed" }] },
        }),
      };
      const run = ledgerAsIs(project("items-run-shards", files));
      expect(rungOf(run, "k.x")).toBe("example");
      expect(rungOf(run, "k.y")).toBe("example");
      expect(w1733(run)).toEqual([]);
    },
    SLOW,
  );

  it(
    "an export of `packages/p/src/f.ts` referenced only by a test its report records `failed` is `none`; passed it is `example`",
    () => {
      const test = [
        'import { expect, it } from "vitest";',
        'import { f, g } from "../src/f.ts";',
        'it("uses f", () => {',
        "  expect(f()).toBe(1);",
        "});",
        'it("uses g", () => {',
        "  expect(g()).toBe(2);",
        "});",
        "",
      ].join("\n");
      const src = "export function f(): number {\n  return 1;\n}\nexport function g(): number {\n  return 2;\n}\n";
      const files = (first: State, second: State): Record<string, string> => ({
        "packages/p/package.json": packageJson("p"),
        "packages/p/src/f.ts": src,
        "packages/p/test/f.test.ts": test,
        [`${REPORTS("p")}/run.json`]: reportText({
          "test/f.test.ts": {
            source: test,
            tests: [
              { line: 3, state: first },
              { line: 6, state: second },
            ],
          },
        }),
      });
      const run = ledgerAsIs(project("items-run-export", files("failed", "passed")));
      const rung = (name: string): unknown => run.records.find((r) => r.item === `packages/p/src/f.ts#${name}`)?.rung;
      expect(rung("f")).toBe("none");
      expect(rung("g")).toBe("example");
      const both = ledgerAsIs(project("items-run-export-ok", files("passed", "passed")));
      expect(both.records.find((r) => r.item === "packages/p/src/f.ts#f")?.rung).toBe("example");
    },
    SLOW,
  );

  it(
    "a test renamed since the report gives no evidence: its file's `sha` is no longer the report's",
    () => {
      const renamed = citingFile(HEADER, { title: "holds under another name" }).source;
      const files = { ...pkg("p", "k.x"), [`packages/p/${A}`]: renamed };
      const run = ledgerAsIs(project("items-run-renamed", files));
      expect(rungOf(run, "k.x")).toBe("none");
      expect(w1733(run)).toEqual([expect.objectContaining({ path: "packages/p/reports/tests/" })]);
    },
    SLOW,
  );

  it(
    "a report edited by hand to say `passed` for a test whose file changed keeps no rung: any edit of the file after the run voids it (property)",
    () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-z ]{1,12}$/), fc.constantFrom("append", "weaken", "fail"), (text, how) => {
          const edited =
            how === "append"
              ? `${CITING.source}// ${text}\n`
              : how === "weaken"
                ? CITING.source.replace("expect(1 + 1).toBe(2);", `expect(${text.length}).toBeGreaterThan(-1);`)
                : CITING.source.replace("toBe(2)", "toBe(3)");
          fc.pre(edited !== CITING.source);
          // the report says `passed` at the sha of the source as it was run, which the edit has changed
          const files = { ...pkg("p", "k.x"), [`packages/p/${A}`]: edited };
          const dir = project("items-run-hand", files);
          const run = ledgerAsIs(dir);
          expect(rungOf(run, "k.x")).toBe("none");
          expect(w1733(run)).toEqual([expect.objectContaining({ path: "packages/p/reports/tests/" })]);
          // restored to the run's source, the same report stands again
          writeFiles(dir, { [`packages/p/${A}`]: CITING.source });
          expect(rungOf(ledgerAsIs(dir), "k.x")).toBe("example");
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    fixedTime(600_000),
  );

  it(
    "a report that exists but holds no entry for a test file gives that file no evidence and is one W1733 naming the file",
    () => {
      const other = citingFile([citeLine("k.y", ONE)]);
      const files = {
        ...pkg("p", "k.x", {
          report: reportText({
            "conformance/other.test.ts": { source: other.source, tests: [{ line: 3, state: "passed" }] },
          }),
        }),
        "packages/p/conformance/other.test.ts": other.source,
        [specPath("k.y")]: specText("k.y", [ONE]),
      };
      const run = ledgerAsIs(project("items-run-lacks", files));
      expect(rungOf(run, "k.x")).toBe("none");
      expect(rungOf(run, "k.y")).toBe("example");
      expect(w1733(run)).toEqual([expect.objectContaining({ path: "packages/p/reports/tests/" })]);
      expect(String(w1733(run)[0]?.message)).toContain(A);
    },
    SLOW,
  );

  it(
    "W1733 names the first file by its path from the project in UTF-16 order: `conformance/B.test.ts` before `conformance/a.test.ts`",
    () => {
      const files = {
        ...pkg("p", "k.x", { report: null }),
        "packages/p/conformance/B.test.ts": CITING.source,
      };
      const run = ledgerAsIs(project("items-run-utf16", files));
      expect(w1733(run)).toHaveLength(1);
      const message = String(w1733(run)[0]?.message);
      expect(message).toContain("B.test.ts");
      expect(message).not.toContain("a.test.ts");
    },
    SLOW,
  );

  it(
    "a project's report counts only for its own files: a report in `packages/p` holding a file path `packages/q` also has gives `packages/q` no evidence and its own W1733",
    () => {
      const files = {
        ...pkg("p", "k.x"),
        "packages/q/package.json": packageJson("q"),
        [`packages/q/${A}`]: CITING.source,
      };
      const run = ledgerAsIs(project("items-run-own", files));
      expect(w1733(run).map((d) => d.path)).toEqual(["packages/q/reports/tests/"]);
    },
    SLOW,
  );
});
