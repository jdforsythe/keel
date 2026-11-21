import type { Schema } from "@keel/schema";

/** Whether `v` has the members every schema has (`node`, `parse`, `encode`). */
export function isSchema(v: unknown): v is Schema<unknown, boolean> {
  return (
    typeof v === "object" &&
    v !== null &&
    "node" in v &&
    "parse" in v &&
    typeof v.parse === "function" &&
    "encode" in v &&
    typeof v.encode === "function"
  );
}
