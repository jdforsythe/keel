/** One unit off an LSP byte stream: a message body, or a malformed frame to report. */
export type LspFrame = { readonly body: string } | { readonly error: string };
