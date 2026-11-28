/** What a condition's value says of a `Result` (R1013): when true, one is not ok; when false, one is not ok. */
export type Narrowing = { readonly whenTrue: boolean; readonly whenFalse: boolean };
