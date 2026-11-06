/** One committed transaction: unique `id` per store, transaction `name`, validated `payload`, `at` from the store clock. */
export interface LogEntry {
  readonly id: number;
  readonly name: string;
  readonly payload: unknown;
  readonly at: number;
}
