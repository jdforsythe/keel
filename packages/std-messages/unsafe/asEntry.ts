import { unsafe } from "./unsafe.ts";

/** A set's schema, built from its keys, typed as the schema of the entry the set's keys describe. */
export function asEntry<T>(x: unknown): T {
  return unsafe(
    "messages() builds the closed schema from K, one field per key of its param kinds, so it parses exactly Entry<K>",
    () => x as T,
  );
}
