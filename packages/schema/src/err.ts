import type { Result } from "./Result.ts";
import { resultBrand } from "./internal/resultBrand.ts";

/** Wrap an expected failure. The result carries the non-enumerable keel brand (`resource` unwraps it, k.reactive). */
export function err<E>(error: E): Result<never, E> {
  const r: Result<never, E> = { ok: false, error };
  return Object.defineProperty(r, resultBrand, { value: true });
}
