/**
 * The one failure of an evaluation (k.evaluator Start, Placing): an `Error` whose `code` is E1048, E1049, E1050 or the
 * E code the evaluated code threw, and whose `message` is the diagnostic's; `what` is what a refusal (E1050) refused,
 * `frames` the bundle positions (1-based line and column) of the refused call's frames, innermost first, and `file`
 * the entry file whose import had not finished, as the entry named it, when it named one.
 */
export class EvaluateFailure extends Error {
  readonly code: string;
  readonly what: string | undefined;
  readonly frames: readonly (readonly [line: number, col: number])[];
  readonly file: string | undefined;
  constructor(
    code: string,
    message: string,
    more: {
      readonly what?: string | undefined;
      readonly frames?: readonly (readonly [number, number])[];
      readonly file?: string | undefined;
    } = {},
  ) {
    super(message);
    this.name = "EvaluateFailure";
    this.code = code;
    this.what = more.what;
    this.frames = more.frames ?? [];
    this.file = more.file;
  }
}
