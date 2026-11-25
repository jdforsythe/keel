/**
 * A `formatLiteral` call the type pass found (E1108, k.formats), judged against the process's format registry on every
 * run, cached or not: `formatAt` and `textAt` are offsets in the file's source, `names` the format names its type
 * carries, `text` the literal's text, or `null` when the argument is no string literal, `owner` the package that
 * declares the `format` value (`""` for a file no `package.json` names, `null` when no declaration can be told), `pkg` the `@keel/std-*` package an identifier `format`
 * is imported from (`null` otherwise), which E1108's fix adds to `deps`.
 */
export type FormatSite = {
  readonly kind: "format";
  readonly path: string;
  readonly formatAt: number;
  readonly textAt: number;
  readonly names: readonly string[];
  readonly text: string | null;
  readonly owner: string | null;
  readonly pkg: string | null;
};
