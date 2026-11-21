/**
 * Options of `explore` (k.model). `from` is the start state (default: the store's current state); `payloads[name]`
 * replaces a transaction's schema domain; a path stops after `depth` edges; `maxStates` (default 10,000, at most
 * 1,000,000) bounds the distinct states. With none of `from`, `payloads` and `depth` the run is the closed form.
 */
export interface ExploreOptions<T> {
  readonly from?: T;
  readonly payloads?: { readonly [transaction: string]: readonly unknown[] };
  readonly depth?: number;
  readonly maxStates?: number;
}
