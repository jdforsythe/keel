// Fixtures for the `keel ledger` conformance tests on simulate, explore, monitored, mutation and type-level evidence.
// Not a test file. Package `m` as in `ledger-fixture.ts`, with `test-sim-project.ts`. Seed: 1337.
import { createHash } from "node:crypto";
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { type CliRecord, type Run, makeProject, removeProject, root } from "./test-sim-project.ts";

/** A temp project that also links `@keel/store`; the callback gets its directory, and the project is removed after. */
export function withProject<T>(prefix: string, files: Readonly<Record<string, string>>, body: (dir: string) => T): T {
  const dir = makeProject(prefix, files);
  try {
    symlinkSync(join(root, "packages", "store"), join(dir, "node_modules", "@keel", "store"));
    return body(dir);
  } finally {
    removeProject(dir);
  }
}

export const readJson = (dir: string, path: string): unknown => JSON.parse(readFileSync(join(dir, path), "utf8"));

export const ledgerRecord = (run: Run, item: string): CliRecord | undefined =>
  run.records.find((r) => r.kind === "ledger" && r.item === item);

export const diags = (run: Run, code: string): CliRecord[] =>
  run.records.filter((r) => r.kind === "diag" && r.code === code);

/** The record's evidence as one JSON string, for shape-agnostic checks of the values it lists. */
export const evidenceText = (record: CliRecord | undefined): string => JSON.stringify(record?.evidence ?? null);

/** Every object anywhere in `value` that has all of `keys`. */
export function collect(value: unknown, keys: readonly string[]): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    if (typeof v !== "object" || v === null) return;
    const rec: Record<string, unknown> = Object.fromEntries(Object.entries(v));
    if (keys.every((k) => k in rec)) found.push(rec);
    for (const x of Object.values(rec)) visit(x);
  };
  visit(value);
  return found;
}

/** A score as a percentage whether the ledger writes a fraction (0.75) or a percentage (75). */
export const percent = (score: unknown): number => {
  if (typeof score !== "number") throw new Error(`score is not a number: ${String(score)}`);
  return score <= 1 ? score * 100 : score;
};

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

// ---- mutation reports (Stryker's mutation report shape, hand-written) ----

export type MutantStatus = "Killed" | "Survived" | "NoCoverage" | "Timeout";
export type Thresholds = { high: number; low: number; break: number };

export const PKG_REPORT = "packages/m/reports/mutation/mutation.json";
export const boundSource = `export function bound(n: number): number {
  return Math.abs(n);
}
`;
export const CLAMP_FILE = "packages/m/src/clamp.ts";
export const BOUND_FILE = "packages/m/src/bound.ts";

/** One Stryker mutation report: files keyed by path relative to the package, each with its source and mutants. */
export function mutationReport(
  files: Readonly<Record<string, { source: string; statuses: readonly MutantStatus[] }>>,
  thresholds: Thresholds,
): string {
  const out: Record<string, unknown> = {};
  for (const [path, f] of Object.entries(files)) {
    out[path] = {
      language: "typescript",
      source: f.source,
      mutants: f.statuses.map((status, i) => ({
        id: `${path}-${i}`,
        mutatorName: "ArithmeticOperator",
        replacement: "-",
        location: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
        status,
      })),
    };
  }
  return `${JSON.stringify({ schemaVersion: "1", thresholds, files: out }, null, 2)}\n`;
}

export const mutantsOf = (killed: number, survived: number, noCoverage = 0): MutantStatus[] => [
  ...Array.from({ length: killed }, (): MutantStatus => "Killed"),
  ...Array.from({ length: survived }, (): MutantStatus => "Survived"),
  ...Array.from({ length: noCoverage }, (): MutantStatus => "NoCoverage"),
];
