import type { LogEntry } from "../types/LogEntry.ts";

/** `entry` without its `meta` key (the client-safe log entry). */
export function withoutMeta(entry: LogEntry): LogEntry {
  return { id: entry.id, name: entry.name, payload: entry.payload, at: entry.at };
}
