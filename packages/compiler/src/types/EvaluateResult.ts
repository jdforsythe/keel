import type { EvaluateFailure } from "../EvaluateFailure.ts";

/**
 * What `evaluate` resolves to (k.evaluator Start): the entry's exports as JSON, a plain object with one member per
 * export that `JSON.stringify` keeps, or one `EvaluateFailure`.
 */
export type EvaluateResult = Readonly<Record<string, unknown>> | EvaluateFailure;
