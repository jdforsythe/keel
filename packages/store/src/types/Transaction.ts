import type { Result, Schema } from "@keel/schema";
import type { TxError } from "../internal/TxError.ts";
import { coreKey } from "../internal/coreKey.ts";
import type { Store } from "./Store.ts";

/** A named, typed, pure state change bound to one store. Run it with `tx(t, payload)`. */
export interface Transaction<T, P> {
  readonly name: string;
  readonly payload: Schema<P>;
  /** The payload schema (same as `payload`); parses every payload `tx` accepts. */
  readonly schema: Schema<P>;
  /** The store this transaction is bound to. */
  readonly store: Store<T>;
  /** Store-private entry point used by `tx`. */
  readonly [coreKey]: (payload: unknown) => Result<T, TxError>;
}
