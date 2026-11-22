// Properties for justified survivors (k.ledger Justified survivors): generated sources, mutants and entries. Seed: 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { justifiedFiles } from "../src/internal/justifiedFiles.ts";
import { justifiedKey } from "../src/internal/justifiedKey.ts";
import { justifiedShape } from "../src/internal/justifiedShape.ts";
import { justifiedText } from "../src/internal/justifiedText.ts";
import { mutantOriginal } from "../src/internal/mutantOriginal.ts";
import { mutationClaims } from "../src/internal/mutationClaims.ts";

const FC = { seed: 1337, numRuns: 100 };
const lineArb = fc.stringMatching(/^[a-z <=(){};]{0,12}$/);
const sourceArb = fc.array(lineArb, { minLength: 1, maxLength: 6 }).map((lines) => lines.join("\n"));

/** 1-based line and column of a 0-based offset. */
const positionAt = (source: string, offset: number): { line: number; column: number } => {
  const before = source.slice(0, offset).split("\n");
  return { line: before.length, column: (before.at(-1) ?? "").length + 1 };
};
const sliceArb = sourceArb.chain((source) =>
  fc
    .tuple(fc.integer({ min: 0, max: source.length }), fc.integer({ min: 0, max: source.length }))
    .map(([a, b]) => ({ source, from: Math.min(a, b), to: Math.max(a, b) })),
);
const entry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  file: "src/a.ts",
  mutator: "EqualityOperator",
  original: "a < b",
  replacement: "a <= b",
  reason: "equivalent",
  note: "No input tells the mutant from the source.",
  ...over,
});

describe("mutantOriginal", () => {
  it("property: a location built from two offsets reads the source between them", () => {
    fc.assert(
      fc.property(sliceArb, ({ source, from, to }) => {
        const location = { start: positionAt(source, from), end: positionAt(source, to) };
        expect(mutantOriginal(source, location)).toBe(source.slice(from, to));
      }),
      FC,
    );
  });
});

describe("justifiedKey and justifiedText", () => {
  it("property: runs of white space in the texts count as one space", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z<=]{1,5}$/), { minLength: 1, maxLength: 5 }), (words) => {
        const base = { file: "src/a.ts", mutator: "M", replacement: "x" };
        expect(justifiedKey({ ...base, original: words.join("\n   ") })).toBe(
          justifiedKey({ ...base, original: words.join(" ") }),
        );
        expect(justifiedText(words.join("\n\t")).length).toBeLessThanOrEqual(40);
        expect(justifiedText(words.join("\n\t"))).not.toMatch(/\s{2}|\n/);
      }),
      FC,
    );
  });
});

describe("justifiedShape", () => {
  it("property: dropping any field, or a reason outside the set, is one problem and no entry", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("file", "mutator", "original", "replacement", "reason", "note"),
        fc.stringMatching(/^[a-z]{1,8}$/).filter((r) => !["equivalent", "unreachable", "performance"].includes(r)),
        (field, reason) => {
          const { [field]: _gone, ...rest } = entry();
          expect(justifiedShape({ justified: [rest] })).toMatchObject({ entries: [], problems: [{ index: 0 }] });
          expect(justifiedShape({ justified: [entry({ reason })] }).problems).toHaveLength(1);
        },
      ),
      FC,
    );
  });

  it("accepts a well-formed file and refuses an equal entry, a note of two sentences and an unknown field", () => {
    expect(justifiedShape({ justified: [entry(), entry({ original: "b < c" })] }).entries).toHaveLength(2);
    expect(justifiedShape({ justified: [entry(), entry({ original: "a  <\n b" })] }).problems).toMatchObject([
      { index: 1, original: "a  <\n b" },
    ]);
    expect(justifiedShape({ justified: [entry({ note: "One. Two." })] }).problems).toHaveLength(1);
    expect(justifiedShape({ justified: [entry({ line: 3 })] }).problems).toHaveLength(1);
    expect(justifiedShape([]).problems).toMatchObject([{ index: -1 }]);
  });
});

describe("justifiedFiles", () => {
  it("gives a package its entries, and E1725 per bad entry of a file that fails its shape", () => {
    const good = { path: "packages/p/mutation-justified.json", source: JSON.stringify({ justified: [entry()] }) };
    const bad = {
      path: "packages/q/mutation-justified.json",
      source: JSON.stringify({ justified: [entry({ reason: "flaky" }), entry(), entry({ note: "" })] }),
    };
    const { justified, diags } = justifiedFiles([
      good,
      bad,
      { path: "packages/r/mutation-justified.json", source: "{" },
    ]);
    expect([...justified.keys()]).toEqual(["p"]);
    expect(diags.map((d) => [d.code, d.path])).toEqual([
      ["E1725", bad.path],
      ["E1725", bad.path],
      ["E1725", "packages/r/mutation-justified.json"],
    ]);
    expect(diags[0]?.message).toContain("a < b");
  });
});

describe("mutationClaims with justified entries", () => {
  const source = "export const f = (a, b) => {\n  if (a < b) return a;\n  return b;\n};\n";
  const location = { start: { line: 2, column: 7 }, end: { line: 2, column: 12 } };
  const mutant = (id: string, status: string, replacement: string) => ({
    id,
    mutatorName: "EqualityOperator",
    replacement,
    status,
    location,
  });
  const claimsOf = (statuses: readonly string[], entries: readonly Record<string, string>[]) =>
    mutationClaims(
      [
        { path: "packages/p/src/a.ts", source },
        {
          path: "packages/p/reports/mutation/mutation.json",
          source: JSON.stringify({
            thresholds: { break: 50 },
            files: {
              "src/a.ts": { source, mutants: statuses.map((s, i) => mutant(`${i}`, s, i === 0 ? "a <= b" : "a >= b")) },
            },
          }),
        },
      ],
      undefined,
      new Map([["p", { entries: justifiedShape({ justified: entries }).entries }]]),
    );
  const le = {
    file: "src/a.ts",
    mutator: "EqualityOperator",
    original: "a < b",
    replacement: "a <= b",
    reason: "equivalent",
    note: "Same.",
  };

  it("property: scoreJustified is the score with the justified mutants left out, never below the score", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("Survived", "NoCoverage", "Killed", "Timeout"),
        fc.array(fc.constantFrom("Survived", "NoCoverage", "Killed", "Timeout"), { minLength: 1, maxLength: 8 }),
        (first, rest) => {
          const { mutation, unmatched } = claimsOf([first, ...rest], [le]);
          const pkg = mutation.packages.p;
          const undetected = first === "Survived" || first === "NoCoverage";
          expect(pkg?.justified).toBe(undetected ? 1 : 0);
          expect(mutation.claims[0]?.justified).toBe(pkg?.justified);
          expect(unmatched.p ?? []).toEqual(undetected ? [] : [0]);
          const killed = pkg?.killed ?? 0;
          const total = killed + (pkg?.survived ?? 0) + (pkg?.noCoverage ?? 0);
          expect(pkg?.score).toBeCloseTo((100 * killed) / total, 1);
          const left = total - (pkg?.justified ?? 0);
          expect(pkg?.scoreJustified).toBeCloseTo(left === 0 ? 100 : (100 * killed) / left, 1);
          expect(pkg?.scoreJustified ?? 0).toBeGreaterThanOrEqual(pkg?.score ?? 0);
        },
      ),
      FC,
    );
  });

  it("with no entries every count of justified is 0 and scoreJustified is the score", () => {
    const { mutation, unmatched } = claimsOf(["Survived", "Killed"], []);
    expect(mutation.packages.p).toEqual({
      score: 50,
      scoreJustified: 50,
      threshold: 50,
      killed: 1,
      survived: 1,
      noCoverage: 0,
      justified: 0,
    });
    expect(unmatched).toEqual({});
  });
});
