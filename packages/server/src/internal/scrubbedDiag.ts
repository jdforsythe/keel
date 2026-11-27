import type { Diag } from "./Diag.ts";
import type { RequestScope } from "./RequestScope.ts";
import { TEXT_CAP } from "./TEXT_CAP.ts";
import { pastCap } from "./pastCap.ts";
import { redacted } from "./redacted.ts";
import { slotLost } from "./slotLost.ts";

/**
 * `d` as the log may hold it (k.privacy Server log), without `lead` and `tail`: its message and each frame `redacted`.
 * When the scope's texts are each one mark (past the cap, `pastCap`; or a set open while the `onSecret` slot was lost,
 * `slotLost`) or the message is over `TEXT_CAP` characters (k.serverlog), a message that starts with its `lead` and
 * ends with its `tail` keeps both and what lies between is `redacted` alone (nothing, for a thrown value's form with
 * no site), so the server's own text stays; a message with no `lead` is one mark whole.
 * Every `diag` record of a request or a runner goes through it.
 */
export function scrubbedDiag(d: Diag, rq: Pick<RequestScope, "pii" | "secrets">): Diag {
  const lead = d.lead ?? "";
  const tail = d.tail ?? "";
  const sets = [rq.secrets, rq.pii];
  const kept =
    lead !== "" &&
    d.message.startsWith(lead) &&
    d.message.length >= lead.length + tail.length &&
    d.message.endsWith(tail) &&
    (d.message.length > TEXT_CAP || sets.some((set) => pastCap.has(set)) || slotLost(sets) !== undefined);
  const body = d.message.slice(lead.length, d.message.length - tail.length);
  // A thrown value's form (`tail` set) with no site has nothing between its parts to mark.
  const marked = body === "" && d.tail !== undefined ? "" : redacted(body, rq);
  const message = kept ? lead + marked + tail : redacted(d.message, rq);
  return {
    code: d.code,
    message,
    ...(d.frames === undefined ? {} : { frames: d.frames.map((f) => redacted(f, rq)) }),
  };
}
