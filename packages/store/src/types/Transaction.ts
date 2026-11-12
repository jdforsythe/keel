import type { Result, Schema } from "@keel/schema";
import type { Concurrent } from "../internal/Concurrent.ts";
import type { TxError } from "../internal/TxError.ts";
import { coreKey } from "../internal/coreKey.ts";
import type { Store } from "./Store.ts";

/** A named, typed, pure state change bound to one store. Run it with `tx(t, payload, { meta, base, key }?)`. */
export interface Transaction<T, P> {
  readonly name: string;
  /** The payload schema; parses every payload `tx` accepts. */
  readonly schema: Schema<P>;
  /** The store this transaction is bound to. */
  readonly store: Store<T>;
  /** What a concurrent write does: `'reject'` (`keel.conflict`, nothing commits) or `'rebase'` (applies to the current state). */
  readonly concurrent: Concurrent;
  /** Store-private entry point used by `tx`: raw payload and raw options, both validated before anything runs. */
  readonly [coreKey]: (payload: unknown, options: unknown) => Result<T, TxError>;
}
