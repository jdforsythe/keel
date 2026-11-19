import type { Result } from "./Result.ts";
import { resultBrand } from "./internal/resultBrand.ts";

/** Wrap a success value. The result carries the non-enumerable keel brand (`resource` unwraps it, k.reactive). */
export function ok<T>(value: T): Result<T, never> {
  const r: Result<T, never> = { ok: true, value };
  return Object.defineProperty(r, resultBrand, { value: true });
}
