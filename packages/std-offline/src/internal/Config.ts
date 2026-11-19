import type { Ctx } from "@keel/ctx";
import type { Infer, JsonValue } from "@keel/schema";
import type { Client, EndpointMap } from "@keel/services";
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
 * What `outbox` declared: the store, its three transactions, the endpoints map, the client of the module's service the
 * flush sends through, the bounds, and the owner last given on each ctx.
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
  /** The owner last given to `send` or `drain` on each ctx; the flush posts only that owner's entries. */
  readonly owners: WeakMap<Ctx, string>;
  /** The ctxs whose flush an `offline.signin` answer paused, until `send` or `drain` gives an owner there again. */
  readonly paused: WeakSet<Ctx>;
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
  /** The entries whose own write to `ctx.storage` (`send`, a `'mine'` `resolve`) has not settled, and that write. */
  readonly writes: Map<string, Promise<unknown>>;
}
