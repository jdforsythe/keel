import { s } from "@keel/schema";

/**
 * `sections[id]` of the inspect document (k.cli Inspector hooks, RFC 0042): the section schema's `doc()` with its
 * encoded value, or with an E1057 `error` when the app failed to read or validate it.
 */
export const InspectSection = s.union([
  s.object({ doc: s.string(), error: s.string() }),
  s.object({ doc: s.string(), value: s.json() }),
]);
