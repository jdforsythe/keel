import { unsafe } from "./unsafe.ts";

/** A set's schema, or a locale file's checked entry, typed as the entry the set's keys describe. */
export function asEntry<T>(x: unknown): T {
  return unsafe("built from K, the set parses Entry<K>; text() gets EntryInput<K>", () => x as T);
}
