/** A stdio protocol server (MCP or LSP): feed it input bytes, write back what it returns. */
export type StdioServer = {
  readonly receive: (chunk: string | Uint8Array) => Promise<string>;
  /** True once the client asked the server to exit (LSP `exit`). */
  readonly done: () => boolean;
};
