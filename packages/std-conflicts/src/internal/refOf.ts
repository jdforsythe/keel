import type { LogEntry } from "@keel/store";
import type { Ref } from "../Ref.ts";

/** The `Ref` of a log entry: `id`, `name`, and `key` when it holds one. */
export function refOf(e: LogEntry): Ref {
  return { id: e.id, name: e.name, ...(e.key === undefined ? {} : { key: e.key }) };
}
