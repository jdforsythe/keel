/** A plain, serializable expected failure (k.errors). `code` is a dotted string literal, never an E-code. */
export type KeelError<C extends string, D> = { readonly code: C; readonly message: string; readonly data: D };
