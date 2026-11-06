/** Outcome of an operation that can fail in an expected way. k.errors builds on this shape. */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
