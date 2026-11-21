// `monitored` evidence (k.ledger Production evidence): string literals of the syntax tree, prefixes of two segments.
import { describe, expect, it } from "vitest";
import { monitoredEvidence } from "../src/internal/monitoredEvidence.ts";

const file = (path: string, source: string) => ({ path, source });
const tally = (tx: Record<string, number>) =>
  file(".keel/monitored.json", JSON.stringify({ v: 1, origin: "http://localhost", from: 0, to: 9, tx }));
const holders = (files: { path: string; source: string }[]): string[] =>
  [...monitoredEvidence(files).byFile.keys()].sort();

describe("monitoredEvidence", () => {
  it("a name in a comment does not count; a string literal does", () => {
    expect(
      holders([
        tally({ "todos.editor.save": 1 }),
        file("src/a.ts", "// see 'todos.editor.save'\nexport const a = 1;\n"),
        file("src/b.ts", "export const b = { id: 'todos.editor.save' };\n"),
      ]),
    ).toEqual(["src/b.ts"]);
  });

  it("the longest prefix of two or more segments counts; a one-segment prefix never does", () => {
    expect(
      holders([
        tally({ "todos.editor.save": 1, "board.add": 2 }),
        file("src/chart.ts", 'export const c = { id: "todos.editor" };\n'),
        file("src/root.ts", 'export const r = { id: "todos" };\n'),
        file("src/board.ts", 'export const b = { id: "board" };\n'),
      ]),
    ).toEqual(["src/chart.ts"]);
  });
});
