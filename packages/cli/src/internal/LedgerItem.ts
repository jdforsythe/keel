import type { Evidence } from "@keel/testing";

/**
 * One ledger item, an export (`<file>#<name>` with its package or app in `pkg`) or a spec clause (`<section>#<key>`,
 * no `pkg`, its 1-based position among the section's bullets in `n`), with its evidence and the test file each piece
 * came from.
 */
export type LedgerItem = {
  readonly item: string;
  readonly pkg?: string;
  readonly n?: number;
  readonly evidence: readonly { readonly ev: Evidence; readonly path: string }[];
};
