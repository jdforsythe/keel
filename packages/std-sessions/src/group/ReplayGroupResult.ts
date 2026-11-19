import type { JsonValue } from "@keel/schema";
import type { Snapshot } from "@keel/store";
import type { ReplayResult } from "../ReplayResult.ts";

/**
 * What `replayGroup` returns (std.multi): each user's `ReplayResult` in user index order, each server store as its
 * snapshot with its log, and `reproduced`, which holds iff every user's fingerprint matches.
 */
export interface ReplayGroupResult {
  readonly users: readonly ReplayResult[];
  readonly server: { readonly [store: string]: Snapshot<JsonValue> };
  readonly reproduced: boolean;
}
