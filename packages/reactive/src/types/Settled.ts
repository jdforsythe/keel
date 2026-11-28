/**
 * What a resource holds when its fetcher resolves `T` (k.reactive, rfc:0068): a k.schema `Result<V, E>` gives `V`
 * (its `err` side is the error state); any other type, `{ ok: boolean; value?: V }` included, stays `T`.
 */
export type Settled<T> = T extends { readonly ok: true; readonly value: infer V }
  ? V
  : T extends { readonly ok: false; readonly error: unknown }
    ? never
    : T;
