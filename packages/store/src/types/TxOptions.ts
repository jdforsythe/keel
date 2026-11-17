import type { LogMeta } from "./LogMeta.ts";

/**
 * Options of `tx`. `meta` is recorded on the log entry (copied, frozen); it never reaches the state. `base` (an integer
 * >= 0) is the head the writer last read: another value than `head()` makes the write concurrent, and the transaction's
 * `concurrent` decides. `key` (1 to 64 characters) names one write across retries: when the store's `keys` holds it for
 * the same transaction, `tx` commits nothing and returns `ok`.
 */
export interface TxOptions {
  readonly meta?: LogMeta;
  readonly base?: number;
  readonly key?: string;
}
