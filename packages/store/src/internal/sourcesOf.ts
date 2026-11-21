import { sourcesFor } from "../../unsafe/sourcesFor.ts";
import type { Transaction } from "../types/Transaction.ts";
import type { Sources } from "./Sources.ts";
import { declaredSources } from "./declaredSources.ts";

/**
 * What `prove` (k.prove) reads of a transaction: `fn`, the function `transaction()` was given, and `invariants`, its
 * store's `invariant()` checks in declaration order (a copy, read at call time). `undefined` for a value that is not a
 * transaction.
 */
export function sourcesOf<T, P>(t: Transaction<T, P>): Sources<T, P> | undefined {
  const entry = declaredSources.get(t);
  return entry === undefined ? undefined : sourcesFor(t, entry);
}
