import { securityHeaders } from "../csp/securityHeaders.ts";
import { OTHER_POLICY } from "./OTHER_POLICY.ts";
import type { Served } from "./Served.ts";
import { httpsOf } from "./httpsOf.ts";
import { policyHeader } from "./policyHeader.ts";

/**
 * `res` with the k.security headers: the six, `Strict-Transport-Security` when `raw` counts as https (`httpsOf`), and,
 * when it carries no policy of its own (a document's nonce policy, a hosted `index.html`'s), `OTHER_POLICY` under the
 * mode's header. A new Response, so a forwarded peer's immutable headers take them too.
 */
export function secured(res: Response, raw: Request, sv: Served): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(securityHeaders({ https: httpsOf(raw, sv.secure, sv.origin) })))
    headers.set(k, v);
  if (!headers.has("content-security-policy") && !headers.has("content-security-policy-report-only"))
    headers.set(policyHeader(sv.mode), OTHER_POLICY);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
