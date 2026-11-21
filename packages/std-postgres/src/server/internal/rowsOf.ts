import type { JsonValue } from "@keel/schema";
import type { Raw } from "./Raw.ts";
import type { TypeCache } from "./TypeCache.ts";
import { decodeValue } from "./decodeValue.ts";

/** Each row of `raw` as an object of JSON values by column name; a later column of one name wins, as in JSON. */
export function rowsOf(raw: Raw, types: TypeCache): Record<string, JsonValue>[] {
  return raw.rows.map((row) => {
    const out: Record<string, JsonValue> = {};
    for (const [i, f] of raw.fields.entries()) out[f.name] = decodeValue(row[i], f.oid, types);
    return out;
  });
}
