import { createHash } from "node:crypto";
import type { Infer } from "@keel/schema";
import type { SourceFile } from "../types/SourceFile.ts";
import type { JustifiedEntry } from "./JustifiedEntry.ts";
import type { LedgerFileSchema } from "./LedgerFileSchema.ts";
import type { MutationClaimSchema } from "./MutationClaimSchema.ts";
import { isRecord } from "./isRecord.ts";
import { justifiedKey } from "./justifiedKey.ts";
import { mutantOriginal } from "./mutantOriginal.ts";

type Claim = Infer<typeof MutationClaimSchema>;
type Mutation = NonNullable<Infer<typeof LedgerFileSchema>["mutation"]>;

const REPORT = /^packages\/([^/]+)\/reports\/mutation\/mutation\.json$/;
const DETECTED = new Set(["Killed", "Timeout"]);
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const UNDETECTED = new Set(["Survived", "NoCoverage"]);
const pct = (detected: number, total: number): number =>
  total === 0 ? 100 : Number(((detected / total) * 100).toFixed(2));

const position = (v: unknown): { line: number; column: number } | undefined =>
  isRecord(v) && typeof v.line === "number" && typeof v.column === "number"
    ? { line: v.line, column: v.column }
    : undefined;

/** The justified-entry key of an undetected mutant of `file` (package-relative), or undefined for any other mutant. */
const undetectedKey = (file: string, source: string, m: unknown): string | undefined => {
  if (!isRecord(m) || typeof m.status !== "string" || !UNDETECTED.has(m.status)) return undefined;
  const start = isRecord(m.location) ? position(m.location.start) : undefined;
  const end = isRecord(m.location) ? position(m.location.end) : undefined;
  if (start === undefined || end === undefined || typeof m.mutatorName !== "string") return undefined;
  return justifiedKey({
    file,
    mutator: m.mutatorName,
    original: mutantOriginal(source, { start, end }),
    replacement: typeof m.replacement === "string" ? m.replacement : "",
  });
};

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
 * (`thresholds.break`); a report replaces the committed claims of the files it covers, other claims stay while their file
 * exists: a claim whose file is not in the tree is dropped. A claim is
 * fresh while the file on disk hashes to its `sha`. Each package's `score` is detected over detected plus undetected
 * across its fresh claims (absent when none is fresh). Scores are percent, stored to two decimals (`ledger.mutation` shows one).
 * `justified` holds each package's `mutation-justified.json` entries (k.ledger Justified survivors): a claim's
 * `justified` counts the Survived and NoCoverage mutants of its file an entry names by file, mutator, original and
 * replacement; a package's counts are summed over its fresh claims and its `scoreJustified` is its score with the
 * justified mutants left out of the count. `unmatched` lists, per package with both a report and entries, the index of
 * each entry that justifies no mutant of the report.
 */
export function mutationClaims(
  files: readonly SourceFile[],
  committed: Mutation | undefined,
  justified: ReadonlyMap<string, { readonly entries: readonly JustifiedEntry[] }> = new Map(),
): {
  mutation: Mutation;
  fresh: ReadonlySet<string>;
  reports: Readonly<Record<string, string>>;
  unmatched: Readonly<Record<string, readonly number[]>>;
} {
  const claims = new Map<string, Claim>((committed?.claims ?? []).map((c) => [c.file, c]));
  const thresholds = new Map(Object.entries(committed?.packages ?? {}).map(([pkg, p]) => [pkg, p.threshold]));
  const reports: Record<string, string> = {};
  const unmatched: Record<string, readonly number[]> = {};
  for (const f of files) {
    const pkg = REPORT.exec(f.path)?.[1];
    const report = pkg === undefined ? undefined : parse(f.source);
    if (pkg === undefined || !isRecord(report) || !isRecord(report.files)) continue;
    reports[pkg] = f.path;
    const limits = isRecord(report.thresholds) ? report.thresholds.break : undefined;
    if (typeof limits === "number") thresholds.set(pkg, limits);
    const entries = justified.get(pkg)?.entries ?? [];
    const byKey = new Map(entries.map((e, i) => [justifiedKey(e), i]));
    const matched = new Set<number>();
    for (const [path, entry] of Object.entries(report.files)) {
      if (!isRecord(entry) || typeof entry.source !== "string") continue;
      const mutants: readonly unknown[] = Array.isArray(entry.mutants) ? entry.mutants : [];
      const count = (statuses: readonly string[]): number =>
        mutants.filter((m) => isRecord(m) && typeof m.status === "string" && statuses.includes(m.status)).length;
      const killed = count([...DETECTED]);
      const survived = count(["Survived"]);
      const noCoverage = count(["NoCoverage"]);
      const total = killed + survived + noCoverage;
      const source = entry.source;
      const covered = mutants.flatMap((m) => {
        const key = undetectedKey(path, source, m);
        const i = key === undefined ? undefined : byKey.get(key);
        return i === undefined ? [] : [i];
      });
      for (const i of covered) matched.add(i);
      if (total === 0) continue;
      const file = `packages/${pkg}/${path}`;
      claims.set(file, {
        file,
        sha: sha256(source),
        killed,
        survived,
        noCoverage,
        justified: covered.length,
        score: pct(killed, total),
      });
    }
    const none = entries.flatMap((_, i) => (matched.has(i) ? [] : [i]));
    if (none.length > 0) unmatched[pkg] = none;
  }
  const disk = new Map(files.map((f) => [f.path, f.source]));
  for (const file of [...claims.keys()]) if (!disk.has(file)) claims.delete(file);
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
    const sum = (of: (c: Claim) => number): number => own.reduce((n, c) => n + of(c), 0);
    const killed = sum((c) => c.killed);
    const survived = sum((c) => c.survived);
    const noCoverage = sum((c) => c.noCoverage);
    const covered = sum((c) => c.justified ?? 0);
    const total = killed + survived + noCoverage;
    const counts = { threshold, killed, survived, noCoverage, justified: covered };
    packages[pkg] =
      total === 0 ? counts : { score: pct(killed, total), scoreJustified: pct(killed, total - covered), ...counts };
  }
  const stored = sorted.map((c) => ({ ...c, justified: c.justified ?? 0 }));
  return { mutation: { packages, claims: stored }, fresh, reports, unmatched };
}
