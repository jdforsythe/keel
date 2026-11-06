import type { Result } from "./Result.ts";

/** Wrap an expected failure. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
