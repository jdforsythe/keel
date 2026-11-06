import type { Budget } from "../types/Budget.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { clip } from "./clip.ts";

/** E1755 (k.check): every budget whose measured `actual` exceeds its `limit`. */
export function budgetBreaches(budgets: readonly Budget[]): Diagnostic[] {
  return budgets
    .filter((b) => b.actual > b.limit)
    .map((b) => ({
      kind: "diag",
      code: "E1755",
      path: b.path ?? "budgets.json",
      line: 1,
      col: 1,
      message: clip(`budget ${clip(b.id, 40)} exceeded: ${b.actual} ${b.unit} > ${b.limit}`, 89),
      see: "k.check",
    }));
}
