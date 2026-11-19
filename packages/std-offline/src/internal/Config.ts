import type { Ctx } from "@keel/ctx";
import type { Infer, JsonValue } from "@keel/schema";
import type { Client, EndpointMap } from "@keel/services";
import type { Store, Transaction } from "@keel/store";
import type { OutboxEntry } from "../OutboxEntry.schema.ts";
import type { Resolution } from "../Resolution.schema.ts";
import type { Flow } from "./Flow.ts";
import type { OutboxState } from "./OutboxState.ts";

type State = Infer<typeof OutboxState>;
type Settle = {
  key: string;
  state: "sent" | "queued" | "sending" | "conflict" | "failed";
  head?: number | undefined;
  error?: JsonValue | undefined;
};

/**
 * What `outbox` declared: the store, its three transactions, the endpoints map, the client of the module's service the
 * flush sends through, the bounds, and per ctx its owner, entries and flush.
 */
export interface Config {
  readonly id: string;
  readonly api: EndpointMap;
  readonly client: Client<EndpointMap>;
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
  /** Each ctx's flush and entries (`flowOf`). */
  readonly flows: WeakMap<Ctx, Flow>;
  /** The entries whose own write to `ctx.storage` (`send`, a `'mine'` `resolve`) has not settled, and that write. */
  readonly writes: Map<string, Promise<unknown>>;
}
