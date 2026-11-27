import { s } from "./s.ts";

/**
 * The kernel's codes an author returns (k.expect Made errors): `keelError.denied.make({})` and its siblings, each with
 * data `{}`, and `keelError.fields`, whose data maps a field path to its message (k.forms). The file is not named for
 * its export, since a file system that ignores case holds the type `KeelError` beside it.
 */
export const keelError = Object.freeze({
  denied: s.error("keel.denied", s.object({})),
  notFound: s.error("keel.notFound", s.object({})),
  conflict: s.error("keel.conflict", s.object({})),
  unreachable: s.error("keel.unreachable", s.object({})),
  busy: s.error("keel.busy", s.object({})),
  fields: s.error("keel.fields", s.record(s.string())),
});
