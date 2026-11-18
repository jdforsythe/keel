import type { Diag } from "./Diag.ts";
import type { RequestScope } from "./RequestScope.ts";
import { SCRUB_CAP } from "./SCRUB_CAP.ts";
import { automatonOf } from "./automatonOf.ts";
import { redacted } from "./redacted.ts";

/**
 * `d` as the log may hold it (k.privacy Server log), without `lead`: below the scrub's caps its message and each frame
 * `redacted` whole, the lead included; past a cap (`automatonOf` is `"over"`) its `lead` kept and the rest of its
 * message one mark, a message that does not start with its `lead` or has none one mark whole, and each frame one mark.
 * A message over `SCRUB_CAP` characters keeps its `lead` too and the rest is `redacted` alone (k.serverlog).
 * Every `diag` record of a request or a runner goes through it.
 */
export function scrubbedDiag(d: Diag, rq: Pick<RequestScope, "pii" | "secrets">): Diag {
  const lead = d.lead ?? "";
  const kept =
    lead !== "" &&
    d.message.startsWith(lead) &&
    (d.message.length > SCRUB_CAP || automatonOf([rq.secrets, rq.pii]) === "over");
  const message = kept ? lead + redacted(d.message.slice(lead.length), rq) : redacted(d.message, rq);
  return {
    code: d.code,
    message,
    ...(d.frames === undefined ? {} : { frames: d.frames.map((f) => redacted(f, rq)) }),
  };
}
