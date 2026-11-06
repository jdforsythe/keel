import type { Io } from "../types/Io.ts";
import type { LspState } from "./LspState.ts";
import { isRecord } from "./isRecord.ts";
import { lspCodeActions } from "./lspCodeActions.ts";
import { lspHover } from "./lspHover.ts";
import { publishAll } from "./publishAll.ts";
import { readRpc } from "./readRpc.ts";
import { rpcReply } from "./rpcReply.ts";

const textDocument = (params: unknown): { uri: string; text: string | undefined } => {
  const p = isRecord(params) ? params : {};
  const doc = isRecord(p.textDocument) ? p.textDocument : {};
  const changes = Array.isArray(p.contentChanges) ? p.contentChanges : [];
  const last: unknown = changes.at(-1);
  const changed = isRecord(last) && typeof last.text === "string" ? last.text : undefined;
  return { uri: typeof doc.uri === "string" ? doc.uri : "", text: typeof doc.text === "string" ? doc.text : changed };
};

/**
 * Handle one LSP message; returns the messages to send (response and notifications). Full document sync:
 * didOpen/didChange/didClose re-run `check` and publish diagnostics; hover shows `explain`; codeAction turns
 * fix diffs into quick fixes.
 */
export async function lspHandle(body: string, state: LspState, provide: () => Io | Promise<Io>): Promise<unknown[]> {
  const msg = readRpc(body);
  if (msg === undefined) return [rpcReply(null, undefined, { code: -32700, message: "parse error" })];
  const reply = (result: unknown): unknown[] => (msg.id === undefined ? [] : [rpcReply(msg.id, result)]);
  switch (msg.method) {
    case "initialize": {
      const p = isRecord(msg.params) ? msg.params : {};
      if (typeof p.rootUri === "string") state.root = decodeURIComponent(p.rootUri.replace(/^file:\/\//, ""));
      return reply({
        capabilities: { textDocumentSync: 1, hoverProvider: true, codeActionProvider: true },
        serverInfo: { name: "keel" },
      });
    }
    case "initialized":
      return [];
    case "shutdown":
      return reply(null);
    case "exit":
      state.exited = true;
      return [];
    case "textDocument/didOpen":
    case "textDocument/didChange": {
      const d = textDocument(msg.params);
      if (d.uri === "" || d.text === undefined) return [];
      state.docs.set(d.uri, d.text);
      return publishAll(state, await provide());
    }
    case "textDocument/didClose": {
      const d = textDocument(msg.params);
      state.docs.delete(d.uri);
      return publishAll(state, await provide(), [d.uri]);
    }
    case "textDocument/codeAction":
      return reply(lspCodeActions(state, state.root ?? (await provide()).cwd, msg.params));
    case "textDocument/hover":
      return reply(lspHover(state, msg.params));
    default:
      return msg.id === undefined
        ? []
        : [rpcReply(msg.id, undefined, { code: -32601, message: `method not found: ${String(msg.method)}` })];
  }
}
