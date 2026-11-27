import { s } from "../s.ts";

/**
 * The kernel's codes an author returns (k.expect Made errors): `keelError.denied.make({})` and its siblings, each with
 * data `{}`; `keelError.conflict`, whose data may name the `transaction` refused and the `head` it met (std.offline);
 * and `keelError.fields`, whose data maps a field path to its message (k.forms).
 * In a folder of its own, since a file system that ignores case holds the type `KeelError.ts` beside `src/`'s files.
 */
export const keelError = Object.freeze({
  denied: s.error("keel.denied", s.object({})),
  notFound: s.error("keel.notFound", s.object({})),
  conflict: s.error("keel.conflict", s.object({ transaction: s.string().optional(), head: s.int().optional() })),
  unreachable: s.error("keel.unreachable", s.object({})),
  busy: s.error("keel.busy", s.object({})),
  fields: s.error("keel.fields", s.record(s.string())),
});
