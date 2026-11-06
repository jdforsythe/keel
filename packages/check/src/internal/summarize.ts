import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Summary } from "../types/Summary.ts";

/** The summary of a diagnostic set: severity totals, per-code counts (keys sorted), `ok` when no E code. */
export function summarize(diags: readonly Diagnostic[]): Summary {
  const tally = new Map<string, number>();
  for (const d of diags) tally.set(d.code, (tally.get(d.code) ?? 0) + 1);
  const counts: Record<string, number> = {};
  for (const code of [...tally.keys()].sort()) counts[code] = tally.get(code) ?? 0;
  const by = (p: string): number => diags.filter((d) => d.code.startsWith(p)).length;
  const errors = diags.length - by("W") - by("I");
  return { kind: "summary", ok: errors === 0, errors, warnings: by("W"), infos: by("I"), counts };
}
