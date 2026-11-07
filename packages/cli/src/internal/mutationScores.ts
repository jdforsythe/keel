import type { SourceFile } from "../types/SourceFile.ts";
import { isRecord } from "./isRecord.ts";

const REPORT = /^packages\/([^/]+)\/reports\/mutation\/mutation\.json$/;
const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Per-package mutation score (percent, one decimal) from each `packages/<pkg>/reports/mutation/mutation.json`
 * (Stryker's report, docs/TESTING.md Mutation): detected / (detected + undetected), Stryker's own formula
 * (ignored, compile and runtime errors excluded). Packages without a readable report or any scored mutant are absent.
 */
export function mutationScores(files: readonly SourceFile[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of files) {
    const pkg = REPORT.exec(f.path)?.[1];
    const report = pkg === undefined ? undefined : parse(f.source);
    if (pkg === undefined || !isRecord(report) || !isRecord(report.files)) continue;
    let detected = 0;
    let undetected = 0;
    for (const file of Object.values(report.files)) {
      const mutants: readonly unknown[] = isRecord(file) && Array.isArray(file.mutants) ? file.mutants : [];
      for (const m of mutants) {
        const status = isRecord(m) ? m.status : undefined;
        if (typeof status !== "string") continue;
        if (DETECTED.has(status)) detected++;
        else if (UNDETECTED.has(status)) undetected++;
      }
    }
    const total = detected + undetected;
    if (total > 0) out[pkg] = Number(((detected / total) * 100).toFixed(1));
  }
  return out;
}
