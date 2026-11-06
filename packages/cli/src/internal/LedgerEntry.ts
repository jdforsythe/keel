/** One exported function and its verification rung (tooling/ledger/ledger.json `exports[]`). */
export type LedgerEntry = {
  readonly pkg: string;
  readonly name: string;
  readonly file: string;
  readonly rung: string;
  readonly evidence: string;
};
