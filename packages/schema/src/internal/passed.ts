import type { Result } from "../Result.ts";
import { resultBrand } from "./resultBrand.ts";

/**
 * `ok(value)` without `ok`'s refusal of a `Result`: what a schema's `parse` returns, since a value `s.result` accepts
 * is a `Result` by its schema (k.schema). The result carries the keel brand.
 */
export function passed<T>(value: T): Result<T, never> {
  const r: Result<T, never> = { ok: true, value };
  return Object.defineProperty(r, resultBrand, { value: true });
}
