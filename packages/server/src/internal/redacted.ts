import type { RequestScope } from "./RequestScope.ts";
import { scrubbed } from "./scrubbed.ts";

/**
 * `text` as the request's log may hold it (k.privacy Server log): each of its `.pii()` values replaced by `[pii]`,
 * then each revealed secret of its action input by `[secret]`, in every written form `scrubbed` matches.
 */
export function redacted(text: string, rq: Pick<RequestScope, "pii" | "secrets">): string {
  return scrubbed(scrubbed(text, rq.pii), rq.secrets, "[secret]");
}
