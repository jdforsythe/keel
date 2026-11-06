import { type JsonValue, type Result, type Schema, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import { fail } from "./fail.ts";

/**
 * Validate one input part (`params`, `query`, `body`) against its schema and JSON-encode it. Invalid input is
 * `api.input` with issue paths prefixed by the part name; an undeclared part encodes to `undefined`.
 */
export function encodePart(
  schema: Schema<unknown, boolean> | undefined,
  part: "params" | "query" | "body",
  input: unknown,
): Result<JsonValue | undefined, ApiError<never>> {
  if (schema === undefined) return ok(undefined);
  const value: unknown = typeof input === "object" && input !== null ? Reflect.get(input, part) : undefined;
  const r = schema.parse(value);
  if (!r.ok) return err(fail.input(r.error.data.issues.map((i) => ({ path: [part, ...i.path], rule: i.rule }))));
  return ok(schema.encode(r.value));
}
