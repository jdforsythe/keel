import type { Result } from "./Result.ts";

/** Wrap a success value. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
