/**
 * Per committed log entry, in memory only: the non-empty strings and numbers (as `String()`) under a `.pii()` mark of
 * its payload as `tx` was given it (`piiValues`), the undeclared keys of a marked open object and all under them among
 * them, which the entry's payload, a copy by the payload schema's codec, no longer holds. A session recorder scrubs
 * them from later error text (std.sessions). Never serialized; an entry dropped from memory drops its list.
 */
export const givenPii = new WeakMap<object, readonly string[]>();
