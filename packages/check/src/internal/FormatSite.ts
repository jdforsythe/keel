/**
 * A `formatLiteral` call the type pass found (E1108, k.formats), judged against the process's format registry on every
 * run, cached or not: `formatAt` and `textAt` are offsets in the file's source, `names` the format names its type
 * carries, `text` the literal's text, or `null` when the argument is no string literal.
 */
export type FormatSite = {
  readonly kind: "format";
  readonly path: string;
  readonly formatAt: number;
  readonly textAt: number;
  readonly names: readonly string[];
  readonly text: string | null;
};
