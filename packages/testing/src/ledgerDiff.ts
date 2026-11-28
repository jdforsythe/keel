import { RUNG_ORDER } from "./internal/RUNG_ORDER.ts";
import type { LedgerDiag } from "./types/LedgerDiag.ts";

const rank = (rung: string): number => RUNG_ORDER.findIndex((r) => r === rung);

/**
 * Compare a ledger with the committed one (`keel ledger --diff`): one E1706 per item whose rung is strictly
 * lower in `after`. Raised, unchanged, new, and removed items, and unknown rung names, are not reported. Pure.
 */
export function ledgerDiff(
  before: readonly { readonly item: string; readonly rung: string }[],
  after: readonly { readonly item: string; readonly rung: string }[],
): LedgerDiag[] {
  const now = new Map(after.map((r) => [r.item, r.rung]));
  const out: LedgerDiag[] = [];
  for (const b of before) {
    const a = now.get(b.item);
    if (a === undefined) continue;
    const was = rank(b.rung);
    const is = rank(a);
    if (was < 0 || is < 0 || is >= was) continue;
    out.push({
      kind: "diag",
      code: "E1706",
      item: b.item,
      before: b.rung,
      after: a,
      message: `ledger rung lowered: ${b.item} ${b.rung} -> ${a}`,
      see: "k.ledger",
    });
  }
  return out;
}
