import { Session } from "../Session.schema.ts";

/** A session file's text as `keel session` writes it: the encoded session, 2-space JSON, one trailing newline. */
export const sessionText = (session: Session): string => `${JSON.stringify(Session.encode(session), null, 2)}\n`;
