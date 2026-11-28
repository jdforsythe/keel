import { type ObjectSchema, type Result, type SchemaError, defect } from "@keel/schema";

/** The channel params a request URL's search parses to, and the key naming that channel instance. */
export function paramsOf<P>(
  schema: ObjectSchema<P>,
  url: string,
): Result<{ readonly value: P; readonly key: string }, SchemaError> {
  // The server hands each handler its request's absolute URL, so one that does not parse is a bug in the server.
  const parsed = URL.parse(url) ?? defect("std.channels: a request URL did not parse");
  const r = schema.decodeStrings(parsed.searchParams);
  return r.ok ? { ok: true, value: { value: r.value, key: JSON.stringify(schema.encode(r.value)) } } : r;
}
