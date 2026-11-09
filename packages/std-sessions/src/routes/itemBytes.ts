import type { Archive } from "../Archive.schema.ts";
import { utf8Length } from "../internal/utf8Length.ts";

/** Bytes of one kept session's JSON outside `session` and `caller`: keys, `bytes`, punctuation. */
const ITEM = 64;

/** An upper bound of one kept session's share of the archive JSON, from its tracked `bytes`. */
export function itemBytes(x: Archive[string]["sessions"][number]): number {
  return x.bytes + utf8Length(JSON.stringify(x.caller)) + ITEM;
}
