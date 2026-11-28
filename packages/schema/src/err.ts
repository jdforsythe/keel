import type { KeelError } from "./KeelError.ts";
import type { Result } from "./Result.ts";
import { defect } from "./defect.ts";
import { isKeelError } from "./internal/isKeelError.ts";
import { resultBrand } from "./internal/resultBrand.ts";

/**
 * Wrap an expected failure (k.attempt). It takes a `KeelError` and nothing else: any other value is the defect E1458.
 * The result carries the non-enumerable keel brand (`resource` and `attempt` read it).
 */
export function err<E extends KeelError<string, unknown>>(error: E): Result<never, E> {
  if (!isKeelError(error)) defect("err takes a KeelError", { code: "E1458" });
  const r: Result<never, E> = { ok: false, error };
  return Object.defineProperty(r, resultBrand, { value: true });
}
