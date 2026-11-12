import { describe, expect, it } from "vitest";
import { parseReport } from "../format-check.mjs";

const report = (diagnostics: unknown[], summary = { changed: 0, unchanged: 3, errors: diagnostics.length }) =>
  JSON.stringify({ summary, diagnostics });

describe("parseReport", () => {
  it("is clean for a report with no diagnostics", () => {
    expect(parseReport(report([]))).toEqual({ diags: [], files: 3 });
  });
  it("makes an F0001 with a fix line for an unformatted file, dropping the ./ prefix", () => {
    const { diags } = parseReport(
      report([{ category: "format", severity: "error", location: { path: { file: "./packages/a/b.ts" } } }]),
    );
    expect(diags).toEqual([
      {
        kind: "diag",
        code: "F0001",
        path: "packages/a/b.ts",
        message: "not formatted",
        fix: "pnpm exec biome format --write packages/a/b.ts",
      },
    ]);
  });
  it("makes an F0002 for a file Biome could not read, one line", () => {
    const { diags } = parseReport(
      report([
        { category: "parse", severity: "error", description: "bad\ntoken", location: { path: { file: "x.json" } } },
      ]),
    );
    expect(diags.map((d) => [d.code, d.message])).toEqual([["F0002", "biome parse: bad"]]);
  });
  it("ignores warnings and counts every file", () => {
    const r = parseReport(
      report([{ category: "format", severity: "warning" }], { changed: 1, unchanged: 4, errors: 2 }),
    );
    expect(r).toEqual({ diags: [], files: 7 });
  });
});
