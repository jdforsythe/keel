import type { Computed } from "@keel/reactive";
import type { KeelError, Result, Schema, SchemaError } from "@keel/schema";
import type { Core } from "../internal/Core.ts";
import { coreKey } from "../internal/coreKey.ts";
import type { LogEntry } from "./LogEntry.ts";
import type { Snapshot } from "./Snapshot.ts";
import type { Transaction } from "./Transaction.ts";

/** Schema-typed state mutated only by its transactions. Reads are reactive. */
export interface Store<T> {
  readonly id: string;
  /** The schema the state is validated against; parses every state the store accepts. */
  readonly schema: Schema<T>;
  /** Each declared transaction's payload schema by name (rfc:0070); schemas only, never the `Transaction` objects. */
  readonly payloads: ReadonlyMap<string, Schema<unknown>>;
  /** Parse `state` with `schema` and run every `invariant`, without committing or logging; `store.invariant` on failure. */
  check(state: unknown): Result<T, KeelError<"store.invariant", { transaction: string }>>;
  /** Reactive read of one top-level key; an effect reading it reruns only when that key changes. */
  get<K extends keyof T>(key: K): T[K];
  /** A computed over the committed state. Call inside a scope. */
  select<R>(fn: (state: T) => R): Computed<R>;
  /** The count of the store's changes: 0 when new, one more per commit and per undo that undoes. Reactive. */
  head(): number;
  /** Committed entries, oldest first. Reactive. */
  log(): readonly LogEntry[];
  /** JSON-safe copy of state, log, `initial` and `head`; log entries carry `meta` only with `{ meta: true }` (never for clients). */
  snapshot(options?: { readonly meta?: boolean }): Snapshot<T>;
  /**
   * Decode a snapshot and replace state, log and head (without `head`: the latest entry's `id`, else 0);
   * `schema.invalid` leaves the store unchanged.
   */
  restore(snapshot: unknown): Result<T, SchemaError>;
  /** Drop the last log entry and restore the state before it, raising the head; false when the log is empty. */
  undo(): boolean;
  /**
   * Undo the latest entry only when `pred(entry)` holds for it; true when it did. An older matching entry is never
   * undone: replaying the log around it would reorder the entries after it.
   */
  undoWhere(pred: (entry: LogEntry) => boolean): boolean;
  /** Declare the transactions the current scope may call; call inside a scope. */
  uses(transactions: readonly Transaction<T, unknown>[]): void;
  /** Store-private hooks used by `transaction` and `invariant`. */
  readonly [coreKey]: Core<T>;
}
