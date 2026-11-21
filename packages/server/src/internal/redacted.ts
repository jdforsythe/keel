import type { RequestScope } from "./RequestScope.ts";
import { scrubbed } from "./scrubbed.ts";

/**
 * `text` as the log may hold it (k.privacy Server log): the revealed value of each `Secret` made or revealed while the request or
 * runner `run` runs (`noteRequestSecrets`) replaced by `[secret]` and each of its `.pii()` values by `[pii]`, in every
 * written form `scrubbed` matches. Where a secret and a pii value overlap, the longer one's mark stands for both; of
 * two as long, `[secret]`. Past a scrub cap (`pastCap`, `automatonOf`) the whole text is one mark.
 */
export function redacted(text: string, rq: Pick<RequestScope, "pii" | "secrets">): string {
  return scrubbed(text, [
    [rq.secrets, "[secret]"],
    [rq.pii, "[pii]"],
  ]);
}
