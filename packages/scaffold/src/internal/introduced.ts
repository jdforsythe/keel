import type { ProxyDiag } from "./ProxyDiag.ts";
import { diagnose } from "./diagnose.ts";

/**
 * The first diagnostic `after` has beyond `before`, counted per code (a renamed file keeps its own
 * pre-existing diagnostics without them counting as new), or null when the edit set introduces none.
 */
export function introduced(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): ProxyDiag | null {
  const budget = new Map<string, number>();
  for (const d of diagnose(before)) budget.set(d.code, (budget.get(d.code) ?? 0) + 1);
  for (const d of diagnose(after)) {
    const left = budget.get(d.code) ?? 0;
    if (left === 0) return d;
    budget.set(d.code, left - 1);
  }
  return null;
}
