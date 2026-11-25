import { unsafe } from "./unsafe.ts";

/** A set's schema, or a locale file's checked entry, typed as the entry the set's keys describe. */
export function asEntry<T>(x: unknown): T {
  return unsafe(
    "messages() builds the closed schema from K, one field per key of its param kinds, so it parses Entry<K>; text() returns its argument unchanged",
    () => x as T,
  );
}
