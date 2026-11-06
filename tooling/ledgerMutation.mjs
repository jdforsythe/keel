// Reads Stryker's reports/mutation/mutation.json for a package (backlog 0036). Returns percent score or undefined.
import fs from "node:fs";
import path from "node:path";

/** Mutation score = detected / (detected + undetected), the same formula as Stryker's own metric (ignored/errors excluded). */
export function mutationScore(pkgDir) {
  const p = path.join(pkgDir, "reports", "mutation", "mutation.json");
  if (!fs.existsSync(p)) return undefined;
  let report;
  try {
    report = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
  let detected = 0;
  let undetected = 0;
  for (const f of Object.values(report.files ?? {}))
    for (const m of f.mutants ?? []) {
      if (m.status === "Killed" || m.status === "Timeout") detected++;
      else if (m.status === "Survived" || m.status === "NoCoverage") undetected++;
    }
  const total = detected + undetected;
  return total === 0 ? undefined : Number(((detected / total) * 100).toFixed(1));
}
