import { type Schema, piiValues } from "@keel/schema";
import { attempted } from "./attempted.ts";

/** Add to `into` the `.pii()` values (`piiValues`) of an encoded `value` of `schema`; a value that fails adds none. */
export function notePii(into: Set<string>, schema: Schema<unknown, boolean>, value: unknown): void {
  const found = attempted(() => piiValues(schema, value));
  if (found.ok) for (const v of found.value) into.add(v);
}
