/** A text replacement over UTF-16 offsets `[start, end)` of a file; a rule's `fix` returns these. */
export type Edit = { readonly start: number; readonly end: number; readonly text: string };
