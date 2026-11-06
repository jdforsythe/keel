import type { RpcMessage } from "./RpcMessage.ts";
import { rpcReply } from "./rpcReply.ts";

/** The error reply for an unserved message (-32700 unparsable, -32600 invalid); undefined for a servable one. */
export function rpcFailure(msg: RpcMessage): Record<string, unknown> | undefined {
  if (msg.kind === "unparsable") return rpcReply(null, undefined, { code: -32700, message: "parse error" });
  if (msg.kind === "invalid") return rpcReply(msg.id, undefined, { code: -32600, message: msg.message });
  return undefined;
}
