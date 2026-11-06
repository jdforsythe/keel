import type { Io } from "../types/Io.ts";
import type { Write } from "./Write.ts";
import { isRecord } from "./isRecord.ts";
import { mcpCall } from "./mcpCall.ts";
import { mcpTools } from "./mcpTools.ts";
import { readRpc } from "./readRpc.ts";
import { rpcReply } from "./rpcReply.ts";

const PROTOCOL = "2025-06-18";

/** Handle one MCP JSON-RPC line; undefined for notifications. Methods: initialize, ping, tools/list, tools/call. */
export async function mcpHandle(
  line: string,
  provide: () => Io | Promise<Io>,
  apply: (writes: readonly Write[]) => void,
): Promise<Record<string, unknown> | undefined> {
  const msg = readRpc(line);
  if (msg === undefined) return rpcReply(null, undefined, { code: -32700, message: "parse error" });
  if (msg.id === undefined) return undefined;
  switch (msg.method) {
    case "initialize": {
      const asked = isRecord(msg.params) ? msg.params.protocolVersion : undefined;
      return rpcReply(msg.id, {
        protocolVersion: typeof asked === "string" ? asked : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "keel", version: "0.0.0" },
      });
    }
    case "ping":
      return rpcReply(msg.id, {});
    case "tools/list":
      return rpcReply(msg.id, { tools: mcpTools() });
    case "tools/call":
      return rpcReply(msg.id, await mcpCall(msg.params, await provide(), apply));
    default:
      return rpcReply(msg.id, undefined, { code: -32601, message: `method not found: ${String(msg.method)}` });
  }
}
