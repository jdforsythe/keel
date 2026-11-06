import type { LspState } from "./internal/LspState.ts";
import { createFramer } from "./internal/createFramer.ts";
import { frameLsp } from "./internal/frameLsp.ts";
import { lspHandle } from "./internal/lspHandle.ts";
import type { Io } from "./types/Io.ts";
import type { StdioServer } from "./types/StdioServer.ts";

/**
 * `keel lsp`: a minimal language server (hand-rolled JSON-RPC, Content-Length framing). Check
 * diagnostics are published as LSP diagnostics on open and change; hover on a diagnostic line shows `explain`.
 */
export function lsp(provide: () => Io | Promise<Io>): StdioServer {
  const framer = createFramer();
  const state: LspState = { root: undefined, exited: false, docs: new Map(), diags: new Map() };
  return {
    done: () => state.exited,
    receive: async (chunk) => {
      const out: string[] = [];
      for (const body of framer.push(chunk)) {
        if (state.exited) break;
        for (const m of await lspHandle(body, state, provide)) out.push(frameLsp(m));
      }
      return out.join("");
    },
  };
}
