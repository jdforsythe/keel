import type { Evidence } from "@keel/testing";

/** One ledger item (`<file>#<name>` or `<spec>#<n>`) with its evidence and the test file each came from. */
export type LedgerItem = {
  readonly item: string;
  readonly evidence: readonly { readonly ev: Evidence; readonly path: string }[];
};
