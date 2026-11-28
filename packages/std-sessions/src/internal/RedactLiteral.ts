/** A string entry of a `redact` array: literal span plus the span that removes it with one adjacent comma. */
export type RedactLiteral = {
  readonly list: string;
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly rmStart: number;
  readonly rmEnd: number;
};
