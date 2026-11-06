import { mcpHandle } from "./internal/mcpHandle.ts";
import type { Io } from "./types/Io.ts";
import type { StdioServer } from "./types/StdioServer.ts";

/**
 * `keel mcp`: an MCP server over stdio framing (newline-delimited JSON-RPC 2.0). One tool per operation,
 * input schema = the operation's input as JSON Schema. `provide` is called per tool call, so the binary can
 * re-read the project each time; effects of successful scaffold/build calls go to `io.apply`. Hand-rolled
 * framing: `@modelcontextprotocol/sdk` is not a dependency.
 */
export function mcp(provide: () => Io | Promise<Io>): StdioServer {
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    done: () => false,
    receive: async (chunk) => {
      buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      const out: string[] = [];
      for (const l of lines) {
        if (l.trim() === "") continue;
        const reply = await mcpHandle(l, provide);
        if (reply !== undefined) out.push(`${JSON.stringify(reply)}\n`);
      }
      return out.join("");
    },
  };
}
