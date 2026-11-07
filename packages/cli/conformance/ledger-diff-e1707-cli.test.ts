// Spec: k.testing, clause "A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line."
// Spec: k.testing, Rules "E1707".
// The real `keel` binary over a temp project (OS tmpdir): a `conformance-covered` section with two clauses, one cited.
// Property seed: 1337 (no property in this file; the fixture tests are trivial).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, keel, makeProject, removeFile, removeProject, summaryOf, writeFiles } from "./test-sim-project.ts";

const SPEC = "spec/kernel/k.fx.md";
const FIRST = "packages/m/conformance/first.test.ts";
const SECOND = "packages/m/conformance/second.test.ts";
const OTHER = "packages/other/conformance/x.test.ts";
const CLAUSE_1 = "Adding one to a number returns the next number.";
const CLAUSE_2 = "Doubling zero returns zero.";

const specLines = (status: string): string[] => [
  "# k.fx: Fixture",
  `status: ${status}`,
  "",
  "**Conformance.**",
  `- ${CLAUSE_1}`,
  `- ${CLAUSE_2}`,
  "",
];
const specText = (status: string): string => specLines(status).join("\n");
// 1-based line of the second bullet, derived from the fixture itself.
const CLAUSE_2_LINE = specLines("conformance-covered").indexOf(`- ${CLAUSE_2}`) + 1;

const citing = (header: string): string =>
  `${header}\nimport { expect, it } from "vitest";\nit("holds", () => {\n  expect(1 + 1).toBe(2);\n});\n`;
const cite = (clause: string): string => citing(`// Spec: k.fx, clause "${clause}"`);

let dir = "";
beforeAll(() => {
  dir = makeProject("ledger-e1707", { [SPEC]: specText("conformance-covered"), [FIRST]: cite(CLAUSE_1) });
}, 60_000);
afterAll(() => {
  removeProject(dir);
});

const e1707 = (run: Run) => run.records.filter((r) => r.kind === "diag" && r.code === "E1707");

describe("k.testing: a `conformance-covered` section with an uncited clause (E1707)", () => {
  it("a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line", () => {
    const diff = keel(dir, ["ledger", "--diff"]);
    expect(diff.status).toBe(1);
    const found = e1707(diff);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "E1707", path: SPEC, line: CLAUSE_2_LINE });
    expect(String(found[0]?.message)).toContain("k.fx");
    expect(String(found[0]?.message)).toContain("clause 2");
    expect(summaryOf(diff)).toMatchObject({ ok: false });
  }, 60_000);

  it("once a test cites the second clause verbatim, `--diff` is ok with no E1707", () => {
    writeFiles(dir, { [SECOND]: cite(CLAUSE_2) });
    const diff = keel(dir, ["ledger", "--diff"]);
    removeFile(dir, SECOND);
    expect(diff.status).toBe(0);
    expect(e1707(diff)).toEqual([]);
    expect(summaryOf(diff)).toMatchObject({ ok: true });
  }, 60_000);

  it.each([
    ["a header naming the clause only by number", "// Spec: k.fx Conformance 2"],
    ["a header quoting only a prefix of the clause", `// Spec: k.fx, clause "${CLAUSE_2.slice(0, 12)}"`],
  ])(
    "%s does not clear E1707",
    (_label, header) => {
      writeFiles(dir, { [SECOND]: citing(header) });
      const diff = keel(dir, ["ledger", "--diff"]);
      removeFile(dir, SECOND);
      expect(diff.status).toBe(1);
      expect(e1707(diff)).toEqual([expect.objectContaining({ path: SPEC, line: CLAUSE_2_LINE })]);
      expect(summaryOf(diff)).toMatchObject({ ok: false });
    },
    60_000,
  );

  it("a header in another package's conformance directory also clears E1707", () => {
    writeFiles(dir, { [OTHER]: cite(CLAUSE_2) });
    const diff = keel(dir, ["ledger", "--diff"]);
    removeFile(dir, OTHER);
    expect(diff.status).toBe(0);
    expect(e1707(diff)).toEqual([]);
    expect(summaryOf(diff)).toMatchObject({ ok: true });
  }, 60_000);

  it("with the section's status `implemented`, the uncited clause gives no E1707", () => {
    writeFiles(dir, { [SPEC]: specText("implemented") });
    const diff = keel(dir, ["ledger", "--diff"]);
    writeFiles(dir, { [SPEC]: specText("conformance-covered") });
    expect(diff.status).toBe(0);
    expect(e1707(diff)).toEqual([]);
  }, 60_000);

  it("restored to the original state, E1707 is reported again", () => {
    expect(e1707(keel(dir, ["ledger", "--diff"]))).toHaveLength(1);
  }, 60_000);
});
