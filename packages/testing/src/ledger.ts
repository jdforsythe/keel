import { RUNG_ORDER } from "./internal/RUNG_ORDER.ts";
import { rungOf } from "./internal/rungOf.ts";
import type { LedgerInput } from "./types/LedgerInput.ts";
import type { LedgerRecord } from "./types/LedgerRecord.ts";
import type { Rung } from "./types/Rung.ts";

/**
 * One ledger record per item, in input order, with the highest rung its passing evidence supports
 * (k.ledger): any passing test is `example`; a passing seeded property with >= 100 runs is
 * `probabilistic`; `exhaustive`, `proven` and `monitored` come only from their own evidence kinds. No passing evidence: `none`.
 */
export function ledger(items: readonly LedgerInput[]): LedgerRecord[] {
  return items.map(({ item, evidence }) => {
    const passing = evidence.filter((ev) => ev.passed);
    let rung: Rung = "none";
    for (const ev of passing) {
      const r = rungOf(ev);
      if (RUNG_ORDER.indexOf(r) > RUNG_ORDER.indexOf(rung)) rung = r;
    }
    return { kind: "ledger", item, rung, evidence: passing.length === 0 ? "none" : passing };
  });
}
