import type { KeelError } from "../KeelError.ts";
import type { Result } from "../Result.ts";
import { isKeelError } from "./isKeelError.ts";
import { resultBrand } from "./resultBrand.ts";

/** Whether `v` is a keel `Result`: one `ok` or `err` made (its own brand) with a `Result`'s shape. */
export function isResult(v: unknown): v is Result<unknown, KeelError<string, unknown>> {
  return (
    typeof v === "object" &&
    v !== null &&
    Object.hasOwn(v, resultBrand) &&
    ((Reflect.get(v, "ok") === true && Object.hasOwn(v, "value")) ||
      (Reflect.get(v, "ok") === false && isKeelError(Reflect.get(v, "error"))))
  );
}
