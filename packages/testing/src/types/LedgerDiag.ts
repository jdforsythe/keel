/** E1706: an item's rung is lower than in the committed ledger (docs/OUTPUT.md diagnostic). */
export interface LedgerDiag {
  readonly kind: "diag";
  readonly code: "E1706";
  readonly item: string;
  readonly before: string;
  readonly after: string;
  readonly message: string;
  readonly see: "k.ledger";
}
