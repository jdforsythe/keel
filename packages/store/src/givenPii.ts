import { givenPiiOf } from "./internal/givenPiiOf.ts";
import type { LogEntry } from "./types/LogEntry.ts";

/**
 * The non-empty strings and numbers (as `String()`) under a `.pii()` mark of `entry`'s payload as `tx` was given it
 * (`piiValues` of `@keel/schema`), a marked open object's undeclared keys and all under them among them, which the
 * logged payload, a copy by the payload schema's codec, no longer holds (k.store). Empty for an entry of an unmarked
 * payload schema, one this process did not commit, or a restored one. Held in memory only, never in a snapshot.
 */
export function givenPii(entry: LogEntry): readonly string[] {
  return givenPiiOf.get(entry) ?? [];
}
