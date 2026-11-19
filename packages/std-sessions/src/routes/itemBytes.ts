import type { Archive } from "../Archive.schema.ts";

/** Bytes of one kept session's JSON outside `session`: keys, `bytes`, punctuation. */
const ITEM = 48;

/** An upper bound of one kept session's share of the archive JSON, from its tracked `bytes`. */
export function itemBytes(x: Archive[string]["sessions"][number]): number {
  return x.bytes + ITEM;
}
