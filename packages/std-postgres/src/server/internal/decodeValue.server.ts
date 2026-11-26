import type { JsonValue } from "@keel/schema";
import type { ArrayItem } from "./ArrayItem.ts";
import type { TypeCache } from "./TypeCache.server.ts";
import { parseArray } from "./parseArray.server.ts";

const BOOL = 16;
const INT8 = 20;
const INTS = new Set([21, 23]);
const FLOATS = new Set([700, 701]);
const JSONS = new Set([114, 3802]);

/**
 * A column value in Postgres text form as a JSON value, by its type oid (std.postgres Values): `bool` a boolean;
 * `int2`, `int4`, `int8`, `float4`, `float8` numbers (an `int8` past 2^53 - 1, or a non-finite float, as its text);
 * `json` and `jsonb` parsed; arrays as arrays, each element decoded by the element type; every other type its text.
 */
export function decodeValue(v: unknown, oid: number, types: TypeCache): JsonValue {
  if (v === null || v === undefined) return null;
  const text = typeof v === "string" ? v : String(v);
  if (oid === BOOL) return text === "t" || text === "true";
  if (INTS.has(oid)) return Number(text);
  if (oid === INT8) {
    const n = Number(text);
    return Number.isSafeInteger(n) ? n : text;
  }
  if (FLOATS.has(oid)) {
    const n = Number(text);
    return Number.isFinite(n) ? n : text;
  }
  if (JSONS.has(oid)) {
    const parsed: JsonValue = JSON.parse(text);
    return parsed;
  }
  const array = types.arrays.get(oid);
  if (array === undefined) return text;
  const each = (item: ArrayItem): JsonValue =>
    typeof item === "string" || item === null ? decodeValue(item, array.elem, types) : item.map(each);
  return parseArray(text, array.delim).map(each);
}
