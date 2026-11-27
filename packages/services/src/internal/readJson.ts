import { type JsonValue, type Result, type SchemaError, ok, s } from "@keel/schema";

/** Parse response text as JSON; an empty body is `null`. Never throws. */
export function readJson(text: string): Result<JsonValue, SchemaError> {
  return text === "" ? ok(null) : s.json.parseJson(text);
}
