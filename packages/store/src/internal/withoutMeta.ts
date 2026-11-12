import type { LogEntry } from "../types/LogEntry.ts";

/** `entry` without its `meta` key (the client-safe log entry); `base` and `key` stay. */
export function withoutMeta(entry: LogEntry): LogEntry {
  const { id, name, payload, at, base, key } = entry;
  return { id, name, payload, at, ...(base === undefined ? {} : { base }), ...(key === undefined ? {} : { key }) };
}
