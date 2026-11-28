import type { Io } from "../types/Io.ts";
import { SHARED_FLAGS } from "./SHARED_FLAGS.ts";
import { errorText } from "./errorText.ts";
import { fillStd } from "./fillStd.ts";
import { isRecord } from "./isRecord.ts";
import { mcpCall } from "./mcpCall.ts";
import { mcpTools } from "./mcpTools.ts";
import { readRpc } from "./readRpc.ts";
import { rpcFailure } from "./rpcFailure.ts";
import { rpcReply } from "./rpcReply.ts";

const PROTOCOL = "2025-06-18";

/**
 * Handle one MCP JSON-RPC line; undefined for notifications. Methods: initialize, ping, tools/list, tools/call.
 * Unparsable -32700, invalid (batch, response, bad id) -32600, unknown method -32601; a throw while serving a
 * request is -32603 for that request only, so one message never silences the server.
 */
export async function mcpHandle(
  line: string,
  provide: () => Io | Promise<Io>,
): Promise<Record<string, unknown> | undefined> {
  const msg = readRpc(line);
  const failure = rpcFailure(msg);
  if (failure !== undefined || msg.kind !== "request") return failure;
  try {
    switch (msg.method) {
      case "initialize": {
        const asked = isRecord(msg.params) ? msg.params.protocolVersion : undefined;
        return rpcReply(msg.id, {
          protocolVersion: typeof asked === "string" ? asked : PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "keel", version: "0.0.0" },
          instructions: SHARED_FLAGS.text,
        });
      }
      case "ping":
        return rpcReply(msg.id, {});
      case "tools/list":
        await fillStd(provide);
        return rpcReply(msg.id, { tools: mcpTools() });
      case "tools/call":
        if (isRecord(msg.params) && (msg.params.name === "session" || msg.params.name === "report"))
          await fillStd(provide);
        return rpcReply(msg.id, await mcpCall(msg.params, await provide()));
      default:
        return rpcReply(msg.id, undefined, {
          code: -32601,
          message: `method not found: ${msg.method}`,
        });
    }
  } catch (e) {
    return rpcReply(msg.id, undefined, {
      code: -32603,
      message: `internal error: ${errorText(e)}`,
    });
  }
}
