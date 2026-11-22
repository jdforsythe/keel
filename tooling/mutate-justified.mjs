// Justified mutation survivors: `packages/<pkg>/mutation-justified.json` (or `apps/<name>/...`) lists the undetected
// mutants (Survived or NoCoverage) that no test can or should kill, by file, mutator, original and replacement text
// (never a line number, which drifts; runs of white space count as one space) with a reason from a closed set and one sentence.
//   node tooling/mutate-justified.mjs [--only <unit>]
// Checks each unit that has the file against its report `reports/mutation/mutation.json`: M0003 an entry missing a
// field, with a reason outside the set, a note that is not one sentence, or equal to another; M0002 an entry that
// matches no undetected mutant of the report, so the file cannot rot; W0016 a unit with the file and no report.
// The shape, an entry's identity and a mutant's original text are `keel ledger`'s own (E1725, `packages/cli/src/internal`).
import fs from "node:fs";
import path from "node:path";
import { mutationUnits, unitDir } from "./mutate-units.mjs";
import { JUSTIFIED_REASONS } from "../packages/cli/src/internal/JUSTIFIED_REASONS.ts";
import { justifiedKey } from "../packages/cli/src/internal/justifiedKey.ts";
import { justifiedShape } from "../packages/cli/src/internal/justifiedShape.ts";
import { mutantOriginal } from "../packages/cli/src/internal/mutantOriginal.ts";
import { run } from "./output.ts";

export const FILE = "mutation-justified.json";
export const REASONS = JUSTIFIED_REASONS;
export const originalText = mutantOriginal;
const UNDETECTED = new Set(["Survived", "NoCoverage"]);
const keyOf = justifiedKey;

/** Problems with the file's shape: `{ index, message }` per bad entry; an unreadable top level is index -1. */
export function shapeProblems(doc) {
  return justifiedShape(doc).problems.map(({ index, message }) => ({ index, message }));
}

/**
 * Matches the entries against `report` (mutation-testing-elements JSON, files keyed relative to the unit).
 * `matched[i]` counts the undetected mutants entry i justifies; the tally counts the unit's mutants, with `score`
 * detected over detected plus undetected and `scoreJustified` the same with the justified mutants left out.
 */
export function justify(report, entries) {
  const byKey = new Map(entries.map((e, i) => [keyOf(e), i]));
  const matched = entries.map(() => 0);
  let killed = 0;
  let timeout = 0;
  let survived = 0;
  let noCoverage = 0;
  let justified = 0;
  for (const [file, entry] of Object.entries(report.files ?? {})) {
    for (const m of entry.mutants ?? []) {
      if (m.status === "Killed") killed++;
      else if (m.status === "Timeout") timeout++;
      else if (m.status === "Survived") survived++;
      else if (m.status === "NoCoverage") noCoverage++;
      if (!UNDETECTED.has(m.status)) continue;
      const original = originalText(entry.source, m.location);
      const i = byKey.get(keyOf({ file, mutator: m.mutatorName, original, replacement: m.replacement ?? "" }));
      if (i === undefined) continue;
      matched[i]++;
      justified++;
    }
  }
  const detected = killed + timeout;
  const undetected = survived + noCoverage;
  const pct = (d, t) => (t === 0 ? 100 : Math.round((d / t) * 10000) / 100);
  return {
    matched,
    tally: {
      killed,
      timeout,
      survived,
      noCoverage,
      justified,
      score: pct(detected, detected + undetected),
      scoreJustified: pct(detected, detected + undetected - justified),
    },
  };
}

/** Diagnostics for one unit directory (repo-relative `dir`) under `root`. */
export function checkUnit(root, dir) {
  const file = path.join(root, dir, FILE);
  if (!fs.existsSync(file)) return { diags: [], entries: 0 };
  const rel = `${dir}/${FILE}`;
  const diag = (code, message) => ({ kind: "diag", code, path: rel, line: 1, col: 1, message });
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return { diags: [diag("M0003", `not JSON: ${e instanceof Error ? e.message : String(e)}`)], entries: 0 };
  }
  const shape = shapeProblems(doc);
  if (shape.length > 0)
    return {
      diags: shape.map((p) => diag("M0003", p.index < 0 ? p.message : `entry ${p.index + 1}: ${p.message}`)),
      entries: 0,
    };
  const reportFile = path.join(root, dir, "reports", "mutation", "mutation.json");
  if (!fs.existsSync(reportFile))
    return { diags: [diag("W0016", "no mutation report to check the entries against")], entries: doc.justified.length };
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const { matched } = justify(report, doc.justified);
  const diags = [];
  matched.forEach((n, i) => {
    if (n > 0) return;
    const e = doc.justified[i];
    diags.push(diag("M0002", `entry ${i + 1} (${e.file} ${e.mutator}) matches no survivor; remove it`));
  });
  return { diags, entries: doc.justified.length };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const root = path.join(import.meta.dirname, "..");
  const args = process.argv.slice(2);
  const k = args.indexOf("--only");
  const only = k >= 0 ? args[k + 1] : undefined;
  await run("mutate-justified", () => {
    const diags = [];
    let units = 0;
    let entries = 0;
    for (const u of mutationUnits(root)) {
      if (only !== undefined && u !== only) continue;
      const r = checkUnit(root, unitDir(u));
      if (r.entries === 0 && r.diags.length === 0) continue;
      units++;
      entries += r.entries;
      diags.push(...r.diags);
    }
    return { diags, counts: { packages: units, entries } };
  });
}
