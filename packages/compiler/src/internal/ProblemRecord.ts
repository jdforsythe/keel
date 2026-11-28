/**
 * One problem of an evaluation as the evaluator recorded it (k.evaluator Placing): its `code`, its `message`, and for
 * a refusal (E1050) `what` it refused and the bundle positions (1-based line and column) of the refused call's frames.
 */
export type ProblemRecord = {
  readonly code: string;
  readonly message?: string | undefined;
  readonly what?: string | undefined;
  readonly frames?: readonly (readonly [number, number])[] | undefined;
};
