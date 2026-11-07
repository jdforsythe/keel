import type { JsonValue, KeelError, Result } from "@keel/schema";
import type { Session } from "./Session.schema.ts";

/** The `session` capability (std.sessions API): real POSTs, shell drops, sim keeps every put in `taken()`. */
export interface SessionSink {
  put(url: URL, session: Session): Promise<Result<null, KeelError<string, JsonValue>>>;
  /** Sessions put on this ctx, in order (sim; real and shell keep none). */
  taken(): readonly { readonly url: URL; readonly session: Session }[];
}
