import type { JsonValue } from "@keel/schema";
import type { Snapshot } from "@keel/store";
import type { Realm } from "./Realm.ts";

/** A group's server and its users' workers (std.multi), shared by `openGroup` and `replayGroup`. */
export interface Hub {
  readonly realms: readonly Realm[];
  /** Resolves when no request or stream chunk is in flight and every user has settled. */
  settle(): Promise<void>;
  /** Moves every clock, the server's included, to `at` when it is behind. */
  advanceTo(at: number): Promise<void>;
  /** The server clock now. */
  now(): number;
  /** Each server store as stored under `keel.store.<id>` now, by id. */
  stored(): Promise<{ [store: string]: string }>;
  /** Each server store the server stored under `keel.store.<id>`, by id, in first-write order. */
  snapshots(): Promise<{ [store: string]: Snapshot<JsonValue> }>;
  /** Ends every worker. */
  close(): Promise<void>;
}
