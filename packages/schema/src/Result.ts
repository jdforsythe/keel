import type { KeelError } from "./KeelError.ts";

/** Outcome of an operation that can fail in an expected way (k.attempt): its error is always a `KeelError`. */
export type Result<T, E extends KeelError<string, unknown>> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
