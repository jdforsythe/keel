import type { CtxEvent } from "@keel/ctx";
import type { JsonValue, KeelError, Schema } from "@keel/schema";
import type { SessionEvent } from "../SessionEvent.ts";
import type { Route } from "./Route.ts";

/** The redaction a recorder applies (std.sessions Redaction): one function per subject. */
export type Redaction = {
  tx(name: string, schema: Schema<unknown, boolean> | undefined, payload: JsonValue): JsonValue;
  state(id: string, schema: Schema<unknown, boolean>, value: JsonValue): JsonValue;
  nav(event: Extract<CtxEvent, { kind: "nav" }>): { readonly route: Route; readonly href: string };
  fire(event: Extract<SessionEvent, { kind: "fire" }>): Extract<SessionEvent, { kind: "fire" }>;
  error(error: KeelError<string, JsonValue>): KeelError<string, JsonValue>;
  /** Fail closed: the error with its message replaced by its code and every string or number in `data` (but `data.at`) masked. */
  blind(error: KeelError<string, JsonValue>): KeelError<string, JsonValue>;
  /** Remember `value` as matched, so later errors are scrubbed of it (a value redacted before the recorder started). */
  remember(value: string): void;
  /** The element ids an `el:` entry masks the value of. */
  readonly elements: readonly string[];
};
