import { CALLER_COOKIE } from "./CALLER_COOKIE.ts";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";

/**
 * `h` with a `set-cookie` for a freshly minted caller token (finding 0082): `HttpOnly` (no script reads it),
 * `SameSite=Lax`, `Path=/`, and `Secure` over https. A caller that sent a valid cookie gets none.
 */
export function issueCaller(r: Req, h: Handled): Handled {
  const c = r.rq.caller;
  if (!c.fresh || c.token === undefined) return h;
  const secure = new URL(r.raw.url).protocol === "https:" ? "; Secure" : "";
  h.response.headers.set("set-cookie", `${CALLER_COOKIE}=${c.token}; Path=/; HttpOnly; SameSite=Lax${secure}`);
  return h;
}
