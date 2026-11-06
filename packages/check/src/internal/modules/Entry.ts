/** A string literal in source: its value and UTF-16 span (`start` is where diagnostics point). */
export type Entry = { readonly value: string; readonly start: number; readonly end: number };
