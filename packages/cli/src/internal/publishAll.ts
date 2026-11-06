import type { Io } from "../types/Io.ts";
import type { LspState } from "./LspState.ts";
import { codeFiles } from "./codeFiles.ts";
import { lspDiagnostic } from "./lspDiagnostic.ts";
import { runCheck } from "./runCheck.ts";
import { uriPath } from "./uriPath.ts";
import { withFiles } from "./withFiles.ts";

/**
 * Re-check the project with open documents overlaid and return one `textDocument/publishDiagnostics`
 * notification per open (or just closed) document. Same `check` call as `keel check`: same diagnostics.
 */
export function publishAll(state: LspState, io: Io, closed: readonly string[] = []): Record<string, unknown>[] {
  const root = state.root ?? io.cwd;
  const open = [...state.docs].map(([uri, source]) => ({ uri, path: uriPath(root, uri), source }));
  const paths = new Set(open.map((d) => d.path));
  const files = [
    ...codeFiles(withFiles(io, "query"), undefined).filter((f) => !paths.has(f.path)),
    ...open.map((d) => ({ path: d.path, source: d.source })),
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const found = open.length === 0 ? [] : runCheck(root, files);
  const notes = open.map((d) => {
    const mine = found.filter((x) => x.path === d.path);
    state.diags.set(d.uri, mine);
    return { uri: d.uri, diagnostics: mine.map(lspDiagnostic) };
  });
  for (const uri of closed) state.diags.delete(uri);
  return [...notes, ...closed.map((uri) => ({ uri, diagnostics: [] }))].map((params) => ({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params,
  }));
}
