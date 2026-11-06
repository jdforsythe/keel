import { operations } from "../operations.ts";
import type { JsonSchema } from "./JsonSchema.ts";
import { toJsonSchema } from "./toJsonSchema.ts";

/** One MCP tool per operation; `inputSchema` is the JSON Schema of the operation's input (k.cli). */
export function mcpTools(): { name: string; description: string; inputSchema: JsonSchema; outputSchema: JsonSchema }[] {
  return operations.map((op) => ({
    name: op.name,
    description: op.description,
    inputSchema: toJsonSchema(op.input.node),
    outputSchema: toJsonSchema(op.output.node),
  }));
}
