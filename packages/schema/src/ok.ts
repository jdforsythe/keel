import type { Result } from "./Result.ts";
import { defect } from "./defect.ts";
import { isResult } from "./internal/isResult.ts";
import { passed } from "./internal/passed.ts";

/**
 * Wrap a success value. The result carries the non-enumerable keel brand (`resource` unwraps it, k.reactive). A keel
 * `Result` given as the value is the defect E1459 (k.attempt): a `Result` holds no `Result`.
 */
export function ok<T>(value: T): Result<T, never> {
  if (isResult(value)) defect("Result in a Result: return the inner Result itself", { code: "E1459" });
  return passed(value);
}
