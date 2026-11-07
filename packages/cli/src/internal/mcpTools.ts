import { operations } from "../operations.ts";
import type { JsonSchema } from "./JsonSchema.ts";
import { toJsonSchema } from "./toJsonSchema.ts";

/**
 * One MCP tool per operation; `inputSchema` is the JSON Schema of the operation's input (k.cli). No `outputSchema`:
 * every tool returns `{ records }` of kind-tagged OUTPUT.md records, and the per-kind schema (the same for all tools)
 * would triple the size of tools/list (budget `mcp.tools-list`).
 */
export function mcpTools(): { name: string; description: string; inputSchema: JsonSchema }[] {
  return operations.map((op) => ({
    name: op.name,
    description: op.description,
    inputSchema: toJsonSchema(op.input.node),
  }));
}
