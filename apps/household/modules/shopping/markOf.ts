import type { OutboxEntry } from "@keel/std-offline";
import { QueuedMark } from "./QueuedMark.schema.ts";

/** The item an outbox entry marks and where it goes; `undefined` for an entry that is no mark. */
export function markOf(entry: OutboxEntry): { readonly id: string; readonly bought: boolean } | undefined {
  const call = QueuedMark.parse(entry.input);
  return entry.endpoint === "mark" && call.ok
    ? { id: call.value.params.id, bought: call.value.body.bought }
    : undefined;
}
