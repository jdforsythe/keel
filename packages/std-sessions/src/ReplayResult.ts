import type { JsonValue, KeelError } from "@keel/schema";
import type { SessionEvent } from "./SessionEvent.ts";

/**
 * What `replay` returns (std.sessions API): the replay's `observed` events (`tx`, `resource`, `error`, and each `net` it applied, recorded again), every store's
 * final `state()`, its first `error`, whether its fingerprint `reproduced` the session's, and `unapplied`: the 0-based
 * index in `events` of the input it stopped at (-1: the base), else null.
 */
export interface ReplayResult {
  readonly observed: readonly SessionEvent[];
  readonly state: { readonly [storeId: string]: JsonValue };
  readonly error: KeelError<string, JsonValue> | null;
  readonly reproduced: boolean;
  readonly unapplied: number | null;
}
