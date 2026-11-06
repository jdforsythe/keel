import type { Evidence } from "./Evidence.ts";

/** One ledger item (`<file>#<name>` or `<spec>#<n>`) with the evidence collected for it. */
export interface LedgerInput {
  readonly item: string;
  readonly evidence: readonly Evidence[];
}
