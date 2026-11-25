// k.ledger-items Run evidence: an a11y item whose project holds no `reports/a11y.json` is `none`, with one W1733 at
// that path. An item whose report is present is computed from it.
import { describe, expect, it } from "vitest";
import type { A11yCriteriaMap } from "../src/internal/A11yCriteriaMap.ts";
import { a11yClaims } from "../src/internal/a11yClaims.ts";
import { a11yReportGaps } from "../src/internal/a11yReportGaps.ts";
import { ledgerCommand } from "../src/internal/ledgerCommand.ts";

const MAP: A11yCriteriaMap = new Map([["1.4.3", { render: ["E1804"], static: [] }]]);
const routes = (...ids: string[]) =>
  JSON.stringify({ data: Object.fromEntries(ids.map((id) => [id, { path: `/${id}`, module: "m" }])), hash: "x" });
const runsOf = (passed: boolean) =>
  JSON.stringify([
    {
      route: "m.r",
      component: null,
      rules: ["E1804"],
      violations: passed ? [] : ["E1804"],
      file: "t.test.ts",
      test: "t",
      passed,
    },
  ]);

describe("a11y claims with and without a report", () => {
  it("is none when the project has no report, and the project is one W1733 at its report path", () => {
    const files = [{ path: "app/.keel/routes.json", source: routes("m.r", "m.s") }];
    expect(a11yClaims(files, MAP).map((c) => [c.item, c.rung])).toEqual([
      ["a11y:app:m.r#1.4.3", "none"],
      ["a11y:app:m.s#1.4.3", "none"],
    ]);
    expect(a11yReportGaps(files)).toEqual([expect.objectContaining({ code: "W1733", path: "app/reports/a11y.json" })]);
    expect(a11yReportGaps(files)[0]?.message).toContain("2 page routes");
  });

  it("computes the item from the report when present, so a violation lowers it, and no W1733", () => {
    const files = (passed: boolean) => [
      { path: "app/.keel/routes.json", source: routes("m.r") },
      { path: "app/reports/a11y.json", source: runsOf(passed) },
    ];
    expect(a11yClaims(files(true), MAP).map((c) => c.rung)).toEqual(["example"]);
    expect(a11yClaims(files(false), MAP).map((c) => c.rung)).toEqual(["none"]);
    expect(a11yReportGaps(files(true))).toEqual([]);
  });

  it("a project with no page route needs no report", () => {
    const layout = JSON.stringify({ data: { "m.l": { path: null, module: "m" } }, hash: "x" });
    expect(a11yReportGaps([{ path: ".keel/routes.json", source: layout }])).toEqual([]);
  });
});

describe("keel ledger over a committed a11y item with no report", () => {
  const MAP2: A11yCriteriaMap = new Map([["1.1.1", { render: ["image-alt"], static: [] }]]);
  const routesFile = { path: "app/.keel/routes.json", source: routes("m.r") };
  const ledger = {
    path: "tooling/ledger/ledger.json",
    source: JSON.stringify({
      version: 1,
      unsafe: 0,
      hostElements: 0,
      exports: [],
      clauses: [],
      a11y: [{ item: "a11y:app:m.r#1.1.1", rung: "example" }],
    }),
  };
  const go = (input: { diff?: true; write?: string }, files: { path: string; source: string }[]) =>
    ledgerCommand(input, { cwd: "/work/app", files }, MAP2);
  const counts = (r: ReturnType<typeof go>) => {
    const t = r.records.at(-1);
    return t?.kind === "summary" ? t.counts : undefined;
  };

  it("writes it at none, reports W1733, and counts nothing kept", () => {
    const r = go({ write: "tooling/ledger/ledger.json" }, [routesFile, ledger]);
    expect(JSON.parse(r.writes[0]?.content ?? "").a11y).toEqual([{ item: "a11y:app:m.r#1.1.1", rung: "none" }]);
    expect(r.records.filter((x) => x.kind === "diag" && x.code === "W1733")).toHaveLength(1);
    expect(counts(r)).not.toHaveProperty("keptNoReport");
  });

  it("--diff reports E1706 for the item a run no longer holds", () => {
    const r = go({ diff: true }, [routesFile, ledger]);
    expect(r.records.filter((x) => x.kind === "diag" && x.code === "E1706")).toHaveLength(1);
  });
});
