/**
 * Each transaction's declared function and its store's live invariant list, filled by the store's `define`, keyed by
 * the transaction object (`sourcesOf`). Type-erased: a WeakMap holds one value type for every `T` and `P`.
 */
export const declaredSources = new WeakMap<object, { readonly fn: object; readonly guards: readonly object[] }>();
