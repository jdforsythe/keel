import { type Schema, attempt, piiValues } from "@keel/schema";

/** Add to `into` the `.pii()` values (`piiValues`) of an encoded `value` of `schema`; a value that fails adds none. */
export function notePii(into: Set<string>, schema: Schema<unknown>, value: unknown): void {
  const found = attempt(() => piiValues(schema, value));
  if (found.ok) for (const v of found.value) into.add(v);
}
