import type { RpcMessage } from "./RpcMessage.ts";
import { isRecord } from "./isRecord.ts";

/**
 * Parse and classify one JSON-RPC 2.0 message: text that is not JSON is `unparsable` (-32700); a batch, a
 * non-object, a message without `jsonrpc: "2.0"` or a string `method` (a response, say), or an id that is not a
 * string, number or null is `invalid` (-32600, with the id when one could be read).
 */
export function readRpc(text: string): RpcMessage {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { kind: "unparsable" };
  }
  if (Array.isArray(v)) return { kind: "invalid", id: null, message: "batch requests are not supported" };
  if (!isRecord(v)) return { kind: "invalid", id: null, message: "a message must be a JSON object" };
  const raw = v.id;
  const id = typeof raw === "string" || typeof raw === "number" || raw === null ? raw : undefined;
  if ("id" in v && id === undefined)
    return { kind: "invalid", id: null, message: "id must be a string, number or null" };
  if (v.jsonrpc !== "2.0") return { kind: "invalid", id: id ?? null, message: 'jsonrpc must be "2.0"' };
  if (typeof v.method !== "string") return { kind: "invalid", id: id ?? null, message: "not a request: no method" };
  return id === undefined
    ? { kind: "notification", method: v.method, params: v.params }
    : { kind: "request", id, method: v.method, params: v.params };
}
