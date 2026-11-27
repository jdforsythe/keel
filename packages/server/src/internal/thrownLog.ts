import type { Diag } from "./Diag.ts";
import type { ThrownRecords } from "./ThrownRecords.ts";
import { thrownForm } from "./thrownForm.ts";
import { thrownText } from "./thrownText.ts";

/**
 * The `ThrownRecords` of a process or an app (k.serverlog Thrown values): the first `diag` is `lead` and the value's
 * form (`thrownForm`) with its `frames`, all but the form's site kept past a scrub cap (`lead`, `tail`), fingerprinted by `fingerprint`; while `full()` holds, a second follows whose
 * message is `lead` and the value's text (`thrownText`), which the caller scrubs (`scrubbedDiag`) and `diagLine` cuts.
 */
export function thrownLog(fingerprint: (input: string) => string, full: () => boolean): ThrownRecords {
  return (code, lead, thrown, frames) => {
    const { head, site, tail } = thrownForm(thrown, frames, fingerprint);
    const first: Diag = { code, lead: lead + head, message: lead + head + site + tail, tail, frames };
    return full() ? [first, { code, lead, message: lead + thrownText(thrown) }] : [first];
  };
}
