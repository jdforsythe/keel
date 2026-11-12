import type { LogMeta } from "./LogMeta.ts";

/**
 * One committed transaction: `id` is the store's head after this commit, transaction `name`, validated `payload`,
 * `at` from the store clock, and `meta` when `tx` was given one (absent otherwise; dropped by `snapshot()` unless
 * `{ meta: true }`). `base` is present only on a concurrent write a `'rebase'` transaction applied; `key` when `tx` was
 * given one. Both stay in `snapshot()`.
 */
export interface LogEntry {
  readonly id: number;
  readonly name: string;
  readonly payload: unknown;
  readonly at: number;
  readonly meta?: LogMeta;
  readonly base?: number;
  readonly key?: string;
}
