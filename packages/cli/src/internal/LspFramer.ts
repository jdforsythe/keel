/** Splits an LSP byte stream into message bodies. */
export type LspFramer = { readonly push: (chunk: string | Uint8Array) => string[] };
