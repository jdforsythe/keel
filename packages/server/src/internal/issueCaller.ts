import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";

/**
 * `h` with the `set-cookie` of a freshly minted, signed caller token (k.server Server state; `callerOf`
 * builds it: `HttpOnly`, `SameSite=Lax`, `Path=/`, and over https `__Host-` and `Secure`). A caller that sent a valid
 * cookie gets none.
 */
export function issueCaller(r: Req, h: Handled): Handled {
  if (r.rq.caller.set !== "") h.response.headers.set("set-cookie", r.rq.caller.set);
  return h;
}
