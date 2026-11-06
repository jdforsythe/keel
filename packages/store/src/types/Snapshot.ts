import type { LogEntry } from "./LogEntry.ts";

/** JSON-safe copy of a store: `state` and `log` went through their schemas' `encode`. */
export interface Snapshot<T> {
  readonly state: T;
  readonly log: readonly LogEntry[];
}
