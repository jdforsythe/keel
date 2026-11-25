import type { LogEntry } from "../types/LogEntry.ts";

/** A log entry plus its transaction applied to its payload, for replay. */
export interface Row<T> {
  readonly entry: LogEntry;
  readonly apply: (state: T) => T;
  /** With a `.pii()`-marked state schema: `givenPii` of the store while this entry is its latest. */
  readonly pii?: readonly string[];
}
