import type { JsonValue, ObjectSchema } from "@keel/schema";

/** The decoded value of `raw` under `schema`, else `raw` (a route with no schema takes it as is). */
export function decoded(
  schema: ObjectSchema<unknown> | undefined,
  raw: { readonly [k: string]: JsonValue },
): Readonly<Record<string, unknown>> {
  if (schema === undefined) return raw;
  const r = schema.parse(raw);
  return r.ok && typeof r.value === "object" && r.value !== null ? { ...r.value } : raw;
}
