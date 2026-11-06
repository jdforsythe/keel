import type { SchemaError } from "@keel/schema";

/** Exception text for an invalid value handed to an encoder (unexpected, not a Result). */
export function issueSummary(error: SchemaError): string {
  return `toFormData: value does not fit the schema (${error.message})`;
}
