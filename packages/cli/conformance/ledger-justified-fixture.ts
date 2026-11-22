// Fixtures for the `keel ledger` justified-survivor conformance tests (k.ledger Justified survivors). Not a test file.
// Package `m` as in `ledger-fixture.ts`. The report is hand-written in Stryker's shape; each mutant carries its
// mutator name, replacement and a location (1-based line and column, end exclusive) that selects its original text in the source.
import { type MutantStatus, type Thresholds } from "./ledger-fixture-kinds.ts";
import { source } from "./ledger-fixture.ts";

export const JUSTIFIED_FILE = "packages/m/mutation-justified.json";
export const ORIGINAL = "Math.min";
export const REPLACEMENT = "Math.max";
export const MUTATOR = "MethodExpression";

const locate = (text: string): { start: { line: number; column: number }; end: { line: number; column: number } } => {
  const lines = source.split("\n");
  const line = lines.findIndex((l) => l.includes(text));
  const column = (lines[line] ?? "").indexOf(text);
  return {
    start: { line: line + 1, column: column + 1 },
    end: { line: line + 1, column: column + 1 + text.length },
  };
};

/** One report over `src/clamp.ts`: `killed` plain Killed mutants, plus the mutant on `Math.min` with `status`. */
export function justifiedReport(status: MutantStatus, killed: number, thresholds: Thresholds): string {
  const target = {
    id: "target",
    mutatorName: MUTATOR,
    replacement: REPLACEMENT,
    location: locate(ORIGINAL),
    status,
  };
  const killedStatus: MutantStatus = "Killed";
  const others = Array.from({ length: killed }, (_, i) => ({
    id: `k${i}`,
    mutatorName: "ArithmeticOperator",
    replacement: "-",
    location: locate("number"),
    status: killedStatus,
  }));
  const files = { "src/clamp.ts": { language: "typescript", source, mutants: [target, ...others] } };
  return `${JSON.stringify({ schemaVersion: "1", thresholds, files }, null, 2)}\n`;
}

export type Entry = Record<string, string>;
export const entry = (over: Entry = {}): Entry => ({
  file: "src/clamp.ts",
  mutator: MUTATOR,
  original: ORIGINAL,
  replacement: REPLACEMENT,
  reason: "equivalent",
  note: "No input tells the mutant from the source.",
  ...over,
});

export const justifiedFile = (entries: readonly Entry[]): string =>
  `${JSON.stringify({ justified: entries }, null, 2)}\n`;
