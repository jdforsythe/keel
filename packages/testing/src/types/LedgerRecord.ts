import type { Evidence } from "./Evidence.ts";
import type { Rung } from "./Rung.ts";

/** One `keel ledger` record: the highest rung held and the passing evidence for it. */
export interface LedgerRecord {
  readonly kind: "ledger";
  readonly item: string;
  readonly rung: Rung;
  readonly evidence: readonly Evidence[] | "none";
}
