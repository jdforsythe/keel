import { operations } from "../operations.ts";
import type { JsonSchema } from "./JsonSchema.ts";
import { SHARED_FLAGS } from "./SHARED_FLAGS.ts";
import { isRecord } from "./isRecord.ts";
import { stdSlot } from "./stdSlot.ts";
import { toJsonSchema } from "./toJsonSchema.ts";

/** `schema` without the flags every command takes, which `initialize` states once (`SHARED_FLAGS`). */
const own = (schema: JsonSchema): JsonSchema => {
  const props = schema.properties;
  if (!isRecord(props)) return schema;
  const kept = Object.entries(props).filter(([k]) => !SHARED_FLAGS.names.includes(k));
  const required = Array.isArray(schema.required)
    ? schema.required.filter((k) => typeof k !== "string" || !SHARED_FLAGS.names.includes(k))
    : undefined;
  return { ...schema, properties: Object.fromEntries(kept), ...(required === undefined ? {} : { required }) };
};

/**
 * One MCP tool per operation; `inputSchema` is the JSON Schema of the operation's input less the flags every
 * command takes, which `initialize`'s `instructions` state once and every tool still accepts (k.cli). No
 * `outputSchema`: every tool returns `{ records }` of kind-tagged OUTPUT.md records, and the per-kind schema (the
 * same for all tools) would triple the size of tools/list (budget `mcp.tools-list`).
 */
export function mcpTools(): {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}[] {
  return [...operations, ...stdSlot.values()].map((op) => ({
    name: op.name,
    description: op.description,
    inputSchema: own(toJsonSchema(op.input.node)),
  }));
}
