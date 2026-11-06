import type { RpcMessage } from "./RpcMessage.ts";
import { isRecord } from "./isRecord.ts";

/** Parse one JSON-RPC message; undefined when the text is not a JSON object. */
export function readRpc(text: string): RpcMessage | undefined {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(v)) return undefined;
  const id = v.id;
  return {
    id: typeof id === "string" || typeof id === "number" || id === null ? id : undefined,
    method: typeof v.method === "string" ? v.method : undefined,
    params: v.params,
  };
}
