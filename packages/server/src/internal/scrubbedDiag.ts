import type { Diag } from "./Diag.ts";
import type { RequestScope } from "./RequestScope.ts";
import { TEXT_CAP } from "./TEXT_CAP.ts";
import { pastCap } from "./pastCap.ts";
import { redacted } from "./redacted.ts";
import { slotLost } from "./slotLost.ts";

/**
 * `d` as the log may hold it (k.privacy Server log), without `lead`: its message and each frame `redacted`. When the
 * scope's texts are each one mark (past the cap, `pastCap`; or a set open while the `onSecret` slot was lost,
 * `slotLost`) or the message is over `TEXT_CAP` characters (k.serverlog), a message that starts with its `lead` keeps
 * it and the rest is `redacted` alone, so the server's own prefix stays; a message with no `lead` is one mark whole.
 * Every `diag` record of a request or a runner goes through it.
 */
export function scrubbedDiag(d: Diag, rq: Pick<RequestScope, "pii" | "secrets">): Diag {
  const lead = d.lead ?? "";
  const sets = [rq.secrets, rq.pii];
  const kept =
    lead !== "" &&
    d.message.startsWith(lead) &&
    (d.message.length > TEXT_CAP || sets.some((set) => pastCap.has(set)) || slotLost(sets) !== undefined);
  const message = kept ? lead + redacted(d.message.slice(lead.length), rq) : redacted(d.message, rq);
  return {
    code: d.code,
    message,
    ...(d.frames === undefined ? {} : { frames: d.frames.map((f) => redacted(f, rq)) }),
  };
}
