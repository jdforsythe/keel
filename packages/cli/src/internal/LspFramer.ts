import type { LspFrame } from "./LspFrame.ts";

/** Splits an LSP byte stream into frames. */
export type LspFramer = { readonly push: (chunk: string | Uint8Array) => LspFrame[] };
