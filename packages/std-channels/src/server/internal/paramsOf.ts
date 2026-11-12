import type { ObjectSchema, Result, SchemaError } from "@keel/schema";

/** The channel params a request URL's search parses to, and the key naming that channel instance. */
export function paramsOf<P>(
  schema: ObjectSchema<P>,
  url: string,
): Result<{ readonly value: P; readonly key: string }, SchemaError> {
  const r = schema.decodeStrings(new URL(url).searchParams);
  return r.ok ? { ok: true, value: { value: r.value, key: JSON.stringify(schema.encode(r.value)) } } : r;
}
