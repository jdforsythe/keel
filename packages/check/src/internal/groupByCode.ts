import type { Diagnostic } from "../types/Diagnostic.ts";

/** Diagnostics grouped by code, groups sorted by code, each group keeping the input order. */
export function groupByCode(diags: readonly Diagnostic[]): [string, Diagnostic[]][] {
  const groups = new Map<string, Diagnostic[]>();
  for (const d of diags) {
    const g = groups.get(d.code);
    if (g === undefined) groups.set(d.code, [d]);
    else g.push(d);
  }
  return [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
