/** Where a module specifier's literal sits: its value, and the offsets of its opening quote and of the closing one. */
export type SpecifierLiteral = { readonly spec: string; readonly start: number; readonly end: number };
