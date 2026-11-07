/** A string-literal brand argument: its text, the quote character, and its UTF-16 span in the file. */
export type BrandLiteral = {
  readonly value: string;
  readonly quote: string;
  readonly start: number;
  readonly end: number;
};
