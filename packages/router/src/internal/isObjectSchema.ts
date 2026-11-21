import type { ObjectSchema } from "@keel/schema";

/** Whether `v` has the members an object schema has (`node`, `parse`, `decodeStrings`). */
export function isObjectSchema(v: unknown): v is ObjectSchema<unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    "node" in v &&
    "parse" in v &&
    typeof v.parse === "function" &&
    "decodeStrings" in v &&
    typeof v.decodeStrings === "function"
  );
}
