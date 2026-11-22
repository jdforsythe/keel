import type { Allow } from "./Allow.ts";

/**
 * What `transaction(fn, opts)` takes (std.postgres). Without it the transaction is `serializable`. `allow` gives some
 * of that up and needs `reason`, a non-empty string literal (E2459), which `keel review` lists beside it.
 */
export type TransactionOptions = {
  readonly allow: Allow;
  readonly reason: string;
};
