import type { JsonValue } from "@keel/schema";

/** Schema-free, JSON-serializable data recorded on a log entry by `tx(t, payload, { meta })`; never part of state. */
export type LogMeta = { readonly [key: string]: JsonValue };
