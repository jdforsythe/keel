import type { Diag } from "./Diag.ts";

/** Mutable LSP server state: open documents by URI, last diagnostics by URI, the workspace root. */
export type LspState = {
  root: string | undefined;
  exited: boolean;
  readonly docs: Map<string, string>;
  readonly diags: Map<string, readonly Diag[]>;
};
