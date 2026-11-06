import type { LogEntry } from "../types/LogEntry.ts";

/** A log entry plus its transaction applied to its payload, for replay. */
export interface Row<T> {
  readonly entry: LogEntry;
  readonly apply: (state: T) => T;
}
