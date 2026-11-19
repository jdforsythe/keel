import { s } from "@keel/schema";
import { hashOf } from "../internal/hashOf.ts";
import type { StdData } from "../types/StdData.ts";

const Data = s.record(s.record(s.json()));

/**
 * The data of a `.keel/std.json` text (k.module Std config, rfc:0066): `{ data, hash }` JSON whose `data` is
 * `{ [pkg]: { [moduleId]: JSON } }` and whose `hash` is the content hash of `data`. Undefined when the text is not
 * JSON, not that shape, or hand-edited (hash mismatch): `createApp` reports E1160.
 */
export function readStd(text: string): StdData | undefined {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof file !== "object" || file === null || !Object.hasOwn(file, "data")) return undefined;
  const data: unknown = Reflect.get(file, "data");
  const r = Data.parse(data);
  return r.ok && Reflect.get(file, "hash") === hashOf(data) ? r.value : undefined;
}
