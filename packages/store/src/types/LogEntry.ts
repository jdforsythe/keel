import type { LogMeta } from "./LogMeta.ts";

/**
 * One committed transaction: unique `id` per store, transaction `name`, validated `payload`, `at` from the store clock,
 * and `meta` when `tx` was given one (absent otherwise; dropped by `snapshot()` unless `{ meta: true }`).
 */
export interface LogEntry {
  readonly id: number;
  readonly name: string;
  readonly payload: unknown;
  readonly at: number;
  readonly meta?: LogMeta;
}
