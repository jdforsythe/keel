/** An LSP TextEdit: replace `range` (0-based, end exclusive) with `newText`. */
export type TextEdit = {
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
  readonly newText: string;
};
