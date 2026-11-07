import type { Evidence } from "@keel/testing";

/**
 * One ledger item, an export (`<file>#<name>` with its package or app in `pkg`) or a spec clause (`<spec>#<n>`, no
 * `pkg`), with its evidence and the test file each piece came from.
 */
export type LedgerItem = {
  readonly item: string;
  readonly pkg?: string;
  readonly evidence: readonly { readonly ev: Evidence; readonly path: string }[];
};
