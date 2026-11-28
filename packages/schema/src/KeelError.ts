/**
 * A plain, serializable expected failure (k.attempt). `code` is a dotted string literal, never an E-code; `cause` is
 * the failure that led to it, when it wraps one.
 */
export type KeelError<C extends string, D> = {
  readonly code: C;
  readonly message: string;
  readonly data: D;
  readonly cause?: KeelError<string, unknown>;
};
