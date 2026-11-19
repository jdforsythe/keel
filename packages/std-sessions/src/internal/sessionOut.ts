import type { Session } from "../Session.schema.ts";
import type { SessionRecord } from "../SessionRecord.ts";
import { isInput } from "./isInput.ts";

/** The `session` output record of `s` (docs/OUTPUT.md): base route, counts, the error code, and the file written. */
export const sessionOut = (s: Session, error: string | null, file: string | null): SessionRecord => ({
  kind: "session",
  id: s.id,
  fingerprint: s.fingerprint,
  route: s.route.id,
  events: s.events.length,
  inputs: s.events.filter(isInput).length,
  error,
  file,
});
