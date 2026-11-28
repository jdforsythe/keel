import type { Schema } from "@keel/schema";
import type { ParamKind } from "./ParamKind.ts";

const TEXT = /^(?:line|para)\(\d+\.\.\d+\)$/;

/** A param schema's kind: `s.string()` or a std.text `line`/`para`, `s.int()`/`s.number()`, `s.enum()`; else none. */
export function kindOf(schema: Schema<unknown, boolean>): ParamKind | undefined {
  const n = schema.node;
  if (n.kind === "string") return "string";
  if (n.kind === "int" || n.kind === "number") return "number";
  if (n.kind === "enum") return n.values;
  return n.kind === "format" && n.base.kind === "string" && TEXT.test(n.name) ? "string" : undefined;
}
