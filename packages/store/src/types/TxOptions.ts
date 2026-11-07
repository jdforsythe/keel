import type { LogMeta } from "./LogMeta.ts";

/** Options of `tx`: `meta` is recorded on the log entry (copied, frozen); it never reaches the state. */
export interface TxOptions {
  readonly meta?: LogMeta;
}
