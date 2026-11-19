import { utf8Length } from "../internal/utf8Length.ts";

/** Bytes of one fingerprint entry's JSON outside its sessions: `count`, `first`, `last`, keys, punctuation. */
const ENTRY = 128;

/** An upper bound of the JSON of fingerprint `fp`'s archive entry outside its sessions. */
export function entryBytes(fp: string): number {
  return utf8Length(JSON.stringify(fp)) + ENTRY;
}
