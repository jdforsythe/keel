import type { Result, Schema } from "@keel/schema";
import type { TxError } from "../internal/TxError.ts";
import { coreKey } from "../internal/coreKey.ts";

/** A named, typed, pure state change bound to one store. Run it with `tx(t, payload)`. */
export interface Transaction<T, P> {
  readonly name: string;
  readonly payload: Schema<P>;
  /** Store-private entry point used by `tx`. */
  readonly [coreKey]: (payload: unknown) => Result<T, TxError>;
}
