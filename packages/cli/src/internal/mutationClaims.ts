import { createHash } from "node:crypto";
import type { Infer } from "@keel/schema";
import type { SourceFile } from "../types/SourceFile.ts";
import type { LedgerFileSchema } from "./LedgerFileSchema.ts";
import type { MutationClaimSchema } from "./MutationClaimSchema.ts";
import { isRecord } from "./isRecord.ts";

type Claim = Infer<typeof MutationClaimSchema>;
type Mutation = NonNullable<Infer<typeof LedgerFileSchema>["mutation"]>;

const REPORT = /^packages\/([^/]+)\/reports\/mutation\/mutation\.json$/;
const DETECTED = new Set(["Killed", "Timeout"]);
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const pct = (detected: number, total: number): number => Number(((detected / total) * 100).toFixed(2));

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Mutation claims (k.ledger Mutation): each Stryker report on disk (`packages/<pkg>/reports/mutation/mutation.json`,
 * `files` keyed relative to the package) gives one claim per file with a scored mutant, and the package's threshold
 * (`thresholds.break`); a report replaces the committed claims of the files it covers, other claims stay. A claim is
 * fresh while the file on disk hashes to its `sha`. Each package's `score` is detected over detected plus undetected
 * across its fresh claims (absent when none is fresh). Scores are percent, stored to two decimals (`ledger.mutation` shows one).
 */
export function mutationClaims(
  files: readonly SourceFile[],
  committed: Mutation | undefined,
): { mutation: Mutation; fresh: ReadonlySet<string>; reports: Readonly<Record<string, string>> } {
  const claims = new Map<string, Claim>((committed?.claims ?? []).map((c) => [c.file, c]));
  const thresholds = new Map(Object.entries(committed?.packages ?? {}).map(([pkg, p]) => [pkg, p.threshold]));
  const reports: Record<string, string> = {};
  for (const f of files) {
    const pkg = REPORT.exec(f.path)?.[1];
    const report = pkg === undefined ? undefined : parse(f.source);
    if (pkg === undefined || !isRecord(report) || !isRecord(report.files)) continue;
    reports[pkg] = f.path;
    const limits = isRecord(report.thresholds) ? report.thresholds.break : undefined;
    if (typeof limits === "number") thresholds.set(pkg, limits);
    for (const [path, entry] of Object.entries(report.files)) {
      if (!isRecord(entry) || typeof entry.source !== "string") continue;
      const mutants: readonly unknown[] = Array.isArray(entry.mutants) ? entry.mutants : [];
      const count = (statuses: readonly string[]): number =>
        mutants.filter((m) => isRecord(m) && typeof m.status === "string" && statuses.includes(m.status)).length;
      const killed = count([...DETECTED]);
      const survived = count(["Survived"]);
      const noCoverage = count(["NoCoverage"]);
      const total = killed + survived + noCoverage;
      if (total === 0) continue;
      const file = `packages/${pkg}/${path}`;
      claims.set(file, { file, sha: sha256(entry.source), killed, survived, noCoverage, score: pct(killed, total) });
    }
  }
  const disk = new Map(files.map((f) => [f.path, f.source]));
  const fresh = new Set(
    [...claims.values()]
      .filter((c) => {
        const source = disk.get(c.file);
        return source !== undefined && sha256(source) === c.sha;
      })
      .map((c) => c.file),
  );
  const sorted = [...claims.values()].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const packages: Mutation["packages"] = {};
  for (const [pkg, threshold] of [...thresholds].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const own = sorted.filter((c) => c.file.startsWith(`packages/${pkg}/`) && fresh.has(c.file));
    const killed = own.reduce((n, c) => n + c.killed, 0);
    const total = own.reduce((n, c) => n + c.killed + c.survived + c.noCoverage, 0);
    packages[pkg] = total === 0 ? { threshold } : { score: pct(killed, total), threshold };
  }
  return { mutation: { packages, claims: sorted }, fresh, reports };
}
