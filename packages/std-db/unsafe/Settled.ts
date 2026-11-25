/** What `settle` gives: the value `run` resolved to, or the value it threw, unchanged. */
export type Settled<T> =
  | { readonly threw: false; readonly value: T }
  | { readonly threw: true; readonly error: unknown };
