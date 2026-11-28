import type { EvaluatorAnswer } from "./EvaluatorAnswer.ts";

/**
 * What `evaluate` takes (k.evaluator Start): `kind` `'data'`; `entry`, a file in a folder holding nothing else;
 * `deadlineMs`, the time from the child's start by the command's monotonic clock after which it is ended with E1048
 * (30,000 unless given); `signal`, which ends the child when aborted (`keel dev`'s superseded evaluation; the call then
 * rejects with the signal's reason); `answer`, the command's answer to each question the evaluator's views ask,
 * which records it (without one every question is refused).
 */
export type EvaluateInput = {
  readonly kind: "data";
  readonly entry: string;
  readonly deadlineMs?: number;
  readonly signal?: AbortSignal;
  readonly answer?: (question: Readonly<Record<string, unknown>>) => EvaluatorAnswer;
};
