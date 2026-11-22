import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkUnit, justify, originalText, shapeProblems } from "../mutate-justified.mjs";

const source = "export const f = (a, b) => {\n  if (a < b) return a;\n  return b;\n};\n";
const at = (line: number, column: number, endLine: number, endColumn: number) => ({
  start: { line, column },
  end: { line: endLine, column: endColumn },
});
const report = {
  files: {
    "src/f.ts": {
      source,
      mutants: [
        {
          id: "1",
          mutatorName: "EqualityOperator",
          replacement: "a <= b",
          status: "Survived",
          location: at(2, 7, 2, 12),
        },
        {
          id: "2",
          mutatorName: "EqualityOperator",
          replacement: "a >= b",
          status: "Killed",
          location: at(2, 7, 2, 12),
        },
        { id: "3", mutatorName: "BlockStatement", replacement: "{}", status: "NoCoverage", location: at(1, 28, 4, 2) },
        {
          id: "4",
          mutatorName: "ConditionalExpression",
          replacement: "true",
          status: "Timeout",
          location: at(2, 7, 2, 12),
        },
      ],
    },
  },
};
const entry = {
  file: "src/f.ts",
  mutator: "EqualityOperator",
  original: "a < b",
  replacement: "a <= b",
  reason: "equivalent",
  note: "At a equal to b both branches return the same value.",
};

describe("originalText", () => {
  it("reads the source between a mutant's 1-based start and end", () => {
    expect(originalText(source, at(2, 7, 2, 12))).toBe("a < b");
    expect(originalText(source, at(1, 28, 4, 2))).toBe("{\n  if (a < b) return a;\n  return b;\n}");
  });
});

describe("shapeProblems", () => {
  it("accepts a well-formed file", () => {
    expect(shapeProblems({ justified: [entry] })).toEqual([]);
  });
  it("requires every field, a reason from the set and a one-sentence note", () => {
    const { reason: _r, ...noReason } = entry;
    expect(shapeProblems({ justified: [noReason] })[0]?.message).toBe("missing reason");
    expect(shapeProblems({ justified: [{ ...entry, reason: "hard" }] })[0]?.message).toMatch(/not one of/);
    expect(shapeProblems({ justified: [{ ...entry, note: "" }] })[0]?.message).toMatch(/missing note/);
    expect(shapeProblems({ justified: [{ ...entry, note: "One. Two." }] })[0]?.message).toBe("note is one sentence");
    expect(shapeProblems({ justified: [{ ...entry, line: 2 }] })[0]?.message).toMatch(/unknown field line/);
    expect(shapeProblems({ justified: [entry, entry] })).toEqual([{ index: 1, message: "equal to an earlier entry" }]);
    expect(shapeProblems([])[0]?.index).toBe(-1);
  });
});

describe("justify", () => {
  it("justifies undetected mutants by file, mutator and texts, never a detected one", () => {
    const killedTwin = { ...entry, replacement: "a >= b" };
    const { matched, tally } = justify(report, [entry, killedTwin]);
    expect(matched).toEqual([1, 0]);
    expect(tally).toEqual({
      killed: 1,
      timeout: 1,
      survived: 1,
      noCoverage: 1,
      justified: 1,
      score: 50,
      scoreJustified: 66.67,
    });
  });
  it("matches a multi-line original written on one line", () => {
    const block = {
      ...entry,
      mutator: "BlockStatement",
      original: "{ if (a < b) return a; return b; }",
      replacement: "{}",
      reason: "unreachable",
    };
    expect(justify(report, [block]).matched).toEqual([1]);
  });
});

describe("checkUnit", () => {
  let root = "";
  const write = (f: string, v: unknown) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), typeof v === "string" ? v : JSON.stringify(v));
  };
  const codes = () => checkUnit(root, "packages/p").diags.map((d) => d.code);
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-justified-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("is silent without the file", () => {
    expect(checkUnit(root, "packages/p")).toEqual({ diags: [], entries: 0 });
  });
  it("warns W0016 when there is no report to check against", () => {
    write("packages/p/mutation-justified.json", { justified: [entry] });
    expect(codes()).toEqual(["W0016"]);
  });
  it("fails M0002 for an entry that matches no survivor, so the file cannot rot", () => {
    write("packages/p/mutation-justified.json", { justified: [entry, { ...entry, original: "b < a" }] });
    write("packages/p/reports/mutation/mutation.json", report);
    const r = checkUnit(root, "packages/p");
    expect(r.diags.map((d) => `${d.code} ${d.message}`)).toEqual([
      "M0002 entry 2 (src/f.ts EqualityOperator) matches no survivor; remove it",
    ]);
  });
  it("fails M0003 for a bad shape or text that is not JSON", () => {
    write("packages/p/mutation-justified.json", { justified: [{ ...entry, reason: "" }] });
    expect(codes()).toEqual(["M0003"]);
    write("packages/p/mutation-justified.json", "{");
    expect(codes()).toEqual(["M0003"]);
  });
});
