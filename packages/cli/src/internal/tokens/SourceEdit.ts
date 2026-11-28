/** Replace `start` to `end` of a source text with `text` (an insertion has `start` equal to `end`). */
export type SourceEdit = { readonly start: number; readonly end: number; readonly text: string };
