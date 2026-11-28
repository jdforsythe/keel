import type { OutboxResult } from "../OutboxResult.ts";

/** One ctx's use of an outbox: its owner, its entries, and its flush (running, paused, retry delay and timer, the key
 * sent once more, who waits). */
export interface Flow {
  busy: boolean;
  delay: number;
  timer: AbortController;
  again: string | undefined;
  /** The owner last given to `send` or `drain`; the flush posts only that owner's entries. */
  owner: string | undefined;
  /** Set by an `offline.signin` answer, until `send` or `drain` gives an owner again. */
  paused: boolean;
  /** Set when a `drain` scope on this ctx ends, until the next `send`, `resolve` or `drain` flushes: no post, no retry. */
  ended: boolean;
  /** Who waits for which key's settlement. */
  readonly waits: Map<string, (r: OutboxResult<unknown>) => void>;
  /** The keys of the entries this ctx added or loaded: its owner change, flush, `resolve` and writes reach only these. */
  readonly held: Set<string>;
  /** Stored entries the load left out because another ctx's entry has their key; each write of this ctx keeps them. */
  readonly kept: unknown[];
}
