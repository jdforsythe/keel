/** One module specifier in a file: its value and the span of the string literal (quotes included). */
export type ImportRef = { readonly spec: string; readonly start: number; readonly end: number };
