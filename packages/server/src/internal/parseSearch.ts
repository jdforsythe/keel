import type { ObjectSchema } from "@keel/schema";
import type { Rec } from "./Rec.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { toRecord } from "./toRecord.ts";

const top = (key: string): string => (key.split(".")[0] ?? key).replace(/\[\]$/, "");

/**
 * Parse a query string by the route's search schema. Undeclared keys and keys whose value fails the schema
 * are dropped; the rest are parsed (k.router Matching). No schema: `{}`. Mirrors the router's parser.
 */
export function parseSearch(schema: ObjectSchema<unknown> | undefined, query: string): Rec {
  if (schema === undefined) return {};
  const declared = new Set(fieldsOf(schema.node).map(([k]) => k));
  let entries = [...new URLSearchParams(query)].filter(([k]) => declared.has(top(k)));
  for (let round = 0; round <= declared.size; round++) {
    const r = schema.decodeStrings(new URLSearchParams(entries));
    if (r.ok) return toRecord(r.value);
    const bad = new Set(r.error.data.issues.map((i) => String(i.path[0] ?? "")));
    const kept = entries.filter(([k]) => !bad.has(top(k)));
    if (kept.length === entries.length) break;
    entries = kept;
  }
  return {};
}
