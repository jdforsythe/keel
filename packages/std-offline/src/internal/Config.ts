import type { Ctx } from "@keel/ctx";
import type { Infer, JsonValue } from "@keel/schema";
import type { EndpointMap } from "@keel/services";
import type { Store, Transaction } from "@keel/store";
import type { OutboxEntry } from "../OutboxEntry.schema.ts";
import type { OutboxResult } from "../OutboxResult.ts";
import type { Resolution } from "../Resolution.schema.ts";
import type { OutboxState } from "./OutboxState.ts";

type State = Infer<typeof OutboxState>;
type Settle = {
  key: string;
  state: "sent" | "queued" | "sending" | "conflict" | "failed";
  head?: number | undefined;
  error?: JsonValue | undefined;
};

/**
 * What `outbox` declared: the store, its three transactions, the endpoints map, the map the flush sends through (every
 * answer read as JSON) and the bounds.
 */
export interface Config {
  readonly id: string;
  readonly api: EndpointMap;
  readonly wire: EndpointMap;
  readonly limit: number;
  readonly maxBytes: number;
  readonly store: Store<State>;
  readonly add: Transaction<State, OutboxEntry>;
  readonly settle: Transaction<State, Settle>;
  readonly resolve: Transaction<State, { key: string; resolution: Resolution }>;
  /** The load of the stored entries, once per ctx. */
  readonly loads: WeakMap<Ctx, Promise<void>>;
  /** False once the scope that declared the outbox is disposed. */
  live: boolean;
  /** The flush: whether it runs, its next retry delay and timer, who waits for which key, the key sent once more. */
  busy: boolean;
  delay: number;
  timer: AbortController;
  readonly waits: Map<string, (r: OutboxResult<unknown>) => void>;
  again: string | undefined;
}
