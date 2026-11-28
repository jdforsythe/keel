/** Counts the json summary holds and the compact trailer leaves out (k.derived Work). */
const QUIET = new Set(["evaluated", "cached"]);

/**
 * `2 files, 0 errors` from a counts record, in insertion order; `evaluated` and `cached` are left out, and so is
 * `refreshed` at 0 (k.derived Refresh: `ok check 217 files, 2 refreshed, 0 errors`).
 */
export function countsText(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts)
    .filter(([k, v]) => !QUIET.has(k) && (k !== "refreshed" || v !== 0))
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}
