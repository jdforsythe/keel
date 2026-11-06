/** One file effect a command asks the host to apply: new content, or `null` to remove. Applied only by the binary. */
export type Write = { readonly path: string; readonly content: string | null; readonly readonly: boolean };
