import type { JsonValue, KeelError } from "@keel/schema";
import type { SessionEvent } from "./SessionEvent.ts";

/**
 * What `replay` returns (std.sessions API): `observed` events (`tx`, `resource`, `error`), the replay's `error`, and
 * whether it `reproduced` the session's fingerprint. `state` (every store's final state) is a placeholder addition
 * for the 0092 RFC; the spec does not name it yet.
 */
export interface ReplayResult {
  readonly observed: readonly SessionEvent[];
  readonly state: { readonly [storeId: string]: JsonValue };
  readonly error: KeelError<string, JsonValue> | null;
  readonly reproduced: boolean;
}
