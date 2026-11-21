import type { JsonValue, KeelError } from "@keel/schema";
import type { Session } from "./Session.schema.ts";
import type { SessionEvent } from "./SessionEvent.ts";

/** What `record` returns (std.sessions API). */
export interface Recorder {
  events(): readonly SessionEvent[];
  errors(): readonly KeelError<string, JsonValue>[];
  stop(): Session;
}
