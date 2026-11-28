import type { Io } from "../types/Io.ts";
import type { LspState } from "./LspState.ts";
import { errorText } from "./errorText.ts";
import { isRecord } from "./isRecord.ts";
import { lspCodeActions } from "./lspCodeActions.ts";
import { lspHover } from "./lspHover.ts";
import { publishAll } from "./publishAll.ts";
import { readRpc } from "./readRpc.ts";
import { rpcFailure } from "./rpcFailure.ts";
import { rpcReply } from "./rpcReply.ts";
import { safeDecode } from "./safeDecode.ts";

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
 * fix diffs into quick fixes. Unparsable -32700, invalid -32600; a throw while serving a message is -32603 for a
 * request and a `window/logMessage` error for a notification, so one message never silences the server.
 */
export async function lspHandle(body: string, state: LspState, provide: () => Io | Promise<Io>): Promise<unknown[]> {
  const msg = readRpc(body);
  const failure = rpcFailure(msg);
  if (failure !== undefined || msg.kind === "invalid" || msg.kind === "unparsable")
    return failure === undefined ? [] : [failure];
  const id = msg.kind === "request" ? msg.id : undefined;
  const reply = (result: unknown): unknown[] => (id === undefined ? [] : [rpcReply(id, result)]);
  try {
    switch (msg.method) {
      case "initialize": {
        const p = isRecord(msg.params) ? msg.params : {};
        if (typeof p.rootUri === "string") state.root = safeDecode(p.rootUri.replace(/^file:\/\//, ""));
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
        return await publishAll(state, await provide());
      }
      case "textDocument/didClose": {
        const d = textDocument(msg.params);
        state.docs.delete(d.uri);
        return await publishAll(state, await provide(), [d.uri]);
      }
      case "textDocument/codeAction":
        return reply(lspCodeActions(state, state.root ?? (await provide()).cwd, msg.params));
      case "textDocument/hover":
        return reply(await lspHover(state, msg.params));
      default:
        return id === undefined
          ? []
          : [rpcReply(id, undefined, { code: -32601, message: `method not found: ${msg.method}` })];
    }
  } catch (e) {
    const text = `${msg.method}: ${errorText(e)}`;
    return id === undefined
      ? [{ jsonrpc: "2.0", method: "window/logMessage", params: { type: 1, message: `keel: ${text}` } }]
      : [rpcReply(id, undefined, { code: -32603, message: `internal error: ${text}` })];
  }
}
