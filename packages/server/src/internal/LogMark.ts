import type { LogEntry, Store } from "@keel/store";

/** The last log entry of each module store before an action ran (`markLogs`); undefined for an empty log. */
export type LogMark = ReadonlyMap<Store<unknown>, LogEntry | undefined>;
