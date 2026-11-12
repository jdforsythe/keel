import type { LogEntry } from "./LogEntry.ts";

/**
 * JSON-safe copy of a store: `state`, `log` and `initial` (the base undo replays from) went through their schemas'
 * `encode`; `head` is the store's `head()`.
 */
export interface Snapshot<T> {
  readonly state: T;
  readonly log: readonly LogEntry[];
  readonly initial: T;
  readonly head: number;
}
