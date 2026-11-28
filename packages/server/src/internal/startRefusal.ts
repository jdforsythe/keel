import { securityHeaders } from "../csp/securityHeaders.ts";
import { OTHER_POLICY } from "./OTHER_POLICY.ts";
import { denied } from "./denied.ts";
import { policyHeader } from "./policyHeader.ts";

/**
 * A refusal `server.mjs` answers before `createApp` (k.security Headers): `res`, or 403 `keel.denied` for `reason`
 * when `res` is a string, with the k.security headers (`Strict-Transport-Security` when `https`) and the production
 * policy for a response that is not a document.
 */
export function startRefusal(res: Response | string, https: boolean): Response {
  const out = typeof res === "string" ? denied(res) : res;
  for (const [k, v] of Object.entries(securityHeaders({ https }))) out.headers.set(k, v);
  out.headers.set(policyHeader("production"), OTHER_POLICY);
  return out;
}
