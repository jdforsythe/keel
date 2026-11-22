type Position = { readonly line: number; readonly column: number };

/**
 * The text a mutant replaces (k.ledger Justified survivors): `source` from the mutant's report location `start` to its
 * `end`, both 1-based line and column, the end exclusive.
 */
export function mutantOriginal(source: string, location: { readonly start: Position; readonly end: Position }): string {
  const lines = source.split("\n");
  const offset = ({ line, column }: Position): number => {
    let o = 0;
    for (let k = 0; k < line - 1; k++) o += (lines[k] ?? "").length + 1;
    return o + column - 1;
  };
  return source.slice(offset(location.start), offset(location.end));
}
