import type { StdioServer } from "../types/StdioServer.ts";
import { errorText } from "./errorText.ts";
import { frameLsp } from "./frameLsp.ts";
import { rpcReply } from "./rpcReply.ts";

/**
 * Feed a streamed stdin through a protocol server, emitting replies as they come, until the input ends or the
 * server is done. A throw while receiving a chunk is answered with a -32603 error (in the protocol's framing)
 * and serving continues.
 */
export async function serveStream(
  server: StdioServer,
  protocol: "mcp" | "lsp",
  stdin: AsyncIterable<string | Uint8Array>,
  emit: (text: string) => void,
): Promise<void> {
  for await (const chunk of stdin) {
    try {
      const out = await server.receive(chunk);
      if (out !== "") emit(out);
    } catch (e) {
      const reply = rpcReply(null, undefined, { code: -32603, message: `internal error: ${errorText(e)}` });
      emit(protocol === "lsp" ? frameLsp(reply) : `${JSON.stringify(reply)}\n`);
    }
    if (server.done()) return;
  }
  if (protocol === "mcp") {
    const tail = await server.receive("\n");
    if (tail !== "") emit(tail);
  }
}
