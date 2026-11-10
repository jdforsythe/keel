import { unsafe } from "./unsafe.ts";

/** A set's schema, or a locale file's checked entry, typed as the entry the set's keys describe. */
export function asEntry<T>(x: unknown): T {
  return unsafe("the set's schema is built from K so parses Entry<K>; text() returns its EntryInput<K>", () => x as T);
}
