// k.ledger File: an a11y item whose project holds no `reports/a11y.json` keeps its committed rung (`kept`). An item whose
// report is present is computed again, and an item whose route is gone is dropped.
import { describe, expect, it } from "vitest";
import type { A11yCriteriaMap } from "../src/internal/A11yCriteriaMap.ts";
import { a11yClaims } from "../src/internal/a11yClaims.ts";
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
const committed = new Map<string, "none" | "example">([
  ["a11y:app:m.r#1.4.3", "example"],
  ["a11y:app:gone.r#1.4.3", "example"],
]);

describe("a11y claims kept for want of a report", () => {
  it("keeps the committed rung when the project has no report", () => {
    const out = a11yClaims([{ path: "app/.keel/routes.json", source: routes("m.r") }], MAP, [], committed);
    expect(out.map((c) => [c.item, c.rung, c.kept])).toEqual([["a11y:app:m.r#1.4.3", "example", true]]);
  });

  it("computes the item again when the report is present, so a violation lowers it", () => {
    const files = (passed: boolean) => [
      { path: "app/.keel/routes.json", source: routes("m.r") },
      { path: "app/reports/a11y.json", source: runsOf(passed) },
    ];
    expect(a11yClaims(files(true), MAP, [], committed).map((c) => [c.rung, c.kept])).toEqual([["example", undefined]]);
    expect(a11yClaims(files(false), MAP, [], committed).map((c) => [c.rung, c.kept])).toEqual([["none", undefined]]);
  });

  it("drops an item whose route is gone and does not invent one the file lacks", () => {
    const out = a11yClaims([{ path: "app/.keel/routes.json", source: routes("m.r", "new.r") }], MAP, [], committed);
    expect(out.map((c) => [c.item, c.rung, c.kept])).toEqual([
      ["a11y:app:m.r#1.4.3", "example", true],
      ["a11y:app:new.r#1.4.3", "none", undefined],
    ]);
  });
});

describe("keel ledger with kept a11y items", () => {
  const MAP2: A11yCriteriaMap = new Map([["1.1.1", { render: ["image-alt"], static: [] }]]);
  const routesFile = { path: "app/.keel/routes.json", source: routes("m.r") };
  const report = (passed: boolean) => ({
    path: "app/reports/a11y.json",
    source: JSON.stringify([
      { route: "m.r", component: null, rules: ["image-alt"], violations: [], file: "t", test: "t", passed },
    ]),
  });
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

  it("writes the committed rung and counts the kept item in the trailer", () => {
    const r = go({ write: "tooling/ledger/ledger.json" }, [routesFile, ledger]);
    expect(JSON.parse(r.writes[0]?.content ?? "").a11y).toEqual([{ item: "a11y:app:m.r#1.1.1", rung: "example" }]);
    expect(counts(r)).toMatchObject({ example: 1, keptNoReport: 1 });
  });

  it("with the report present the item is recomputed: a failing run lowers it, E1706, nothing kept", () => {
    const r = go({ diff: true }, [routesFile, report(false), ledger]);
    expect(r.records.filter((x) => x.kind === "diag").map((x) => x.kind === "diag" && x.code)).toEqual(["E1706"]);
    expect(counts(r)).not.toHaveProperty("keptNoReport");
  });

  it("with no report and no committed item the rung is none, and nothing is kept", () => {
    const r = go({ write: "l.json" }, [routesFile]);
    expect(JSON.parse(r.writes[0]?.content ?? "").a11y).toEqual([{ item: "a11y:app:m.r#1.1.1", rung: "none" }]);
    expect(counts(r)).not.toHaveProperty("keptNoReport");
  });
});
