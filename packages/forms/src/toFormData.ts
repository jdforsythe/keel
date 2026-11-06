import type { Infer, ObjectSchema } from "@keel/schema";
import { encodeEntries } from "./internal/encodeEntries.ts";
import { issueSummary } from "./internal/issueSummary.ts";

/**
 * Encode a valid value as FormData by its schema, so `schema.decodeStrings(toFormData(schema, v))` returns
 * `ok(v)` (k.forms, k.schema decodeStrings): numbers and booleans as text, nested keys dotted, arrays as
 * repeated keys, absent optionals omitted, null as ''. Throws, like `encode`, when `value` does not fit.
 */
export function toFormData<S extends ObjectSchema<object>>(schema: S, value: Infer<S>): FormData {
  const parsed = schema.parse(value);
  if (!parsed.ok) throw new Error(issueSummary(parsed.error));
  const fd = new FormData();
  encodeEntries(schema.node, "", value, (k, v) => fd.append(k, v));
  return fd;
}
