import { unsafe } from "./unsafe.ts";

/** A set's schema, built from its keys, typed as the schema of the entry the set's keys describe. */
export function asEntry<T>(x: unknown): T {
  return unsafe("built from K, the closed object schema parses exactly Entry<K>", () => x as T);
}
