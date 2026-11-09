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
};
