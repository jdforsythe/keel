import { securityHeaders } from "../csp/securityHeaders.ts";
import { OTHER_POLICY } from "./OTHER_POLICY.ts";
import type { Served } from "./Served.ts";
import { attempted } from "./attempted.ts";
import { httpsOf } from "./httpsOf.ts";
import { policyHeader } from "./policyHeader.ts";

/** Set the headers on `h`; false when they are immutable (a fetched peer response's). */
const stamp = (h: Headers, sv: Served, raw: Request): boolean =>
  attempted(() => {
    for (const [k, v] of Object.entries(securityHeaders({ https: httpsOf(raw, sv.secure, sv.origin) }))) h.set(k, v);
    if (!h.has("content-security-policy") && !h.has("content-security-policy-report-only"))
      h.set(policyHeader(sv.mode), OTHER_POLICY);
  }).ok;

/**
 * `res` with the k.security headers: the six, `Strict-Transport-Security` when `raw` counts as https (`httpsOf`), and,
 * when it carries no policy of its own (a document's nonce policy, a hosted `index.html`'s), `OTHER_POLICY` under the
 * mode's header. Set in place; a response with immutable headers (a forwarded peer's) is copied first.
 */
export function secured(res: Response, raw: Request, sv: Served): Response {
  if (stamp(res.headers, sv, raw)) return res;
  const copy = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
  stamp(copy.headers, sv, raw);
  return copy;
}
