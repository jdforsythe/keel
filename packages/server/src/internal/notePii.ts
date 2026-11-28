import { type Schema, piiValues } from "@keel/schema";
import { attempted } from "./attempted.ts";
import { holdValues } from "./holdValues.ts";

/**
 * Add to `into` the `.pii()` values (`piiValues`) of an encoded `value` of `schema`, counted toward the scrub's cap
 * (`holdValues`); a value that fails adds none.
 */
export function notePii(into: Set<string>, schema: Schema<unknown, boolean>, value: unknown): void {
  const found = attempted(() => piiValues(schema, value));
  if (found.ok) holdValues(into, found.value);
}
