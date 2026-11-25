import { givenPiiOf } from "./internal/givenPiiOf.ts";
import { statePiiOf } from "./internal/statePiiOf.ts";
import type { LogEntry } from "./types/LogEntry.ts";
import type { Store } from "./types/Store.ts";

/**
 * The non-empty strings and numbers (as `String()`) under a `.pii()` mark (`piiValues` of `@keel/schema`), a marked
 * open object's undeclared keys and all under them among them, of a value as it was given, before the store's codec
 * copy dropped what its schema does not declare (k.store): for a log entry, its payload as `tx` was given it (empty
 * for an unmarked payload schema, an entry this process did not commit, or a restored one); for a store, its current
 * state as last given: `initial` at creation, the state a `restore` was given, or the state a commit or undo made.
 * Held in memory only, never in a snapshot.
 */
export function givenPii(of: LogEntry | Store<unknown>): readonly string[] {
  return statePiiOf.get(of)?.() ?? givenPiiOf.get(of) ?? [];
}
