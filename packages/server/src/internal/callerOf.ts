import { CALLER_COOKIE } from "./CALLER_COOKIE.ts";
import type { Caller } from "./Caller.ts";
import type { Served } from "./Served.ts";
import { httpsOf } from "./httpsOf.ts";
import { isVerb } from "./isVerb.ts";

/**
 * The caller of `raw` (k.server Server state). Over https the cookie is `__Host-keel-caller` and
 * `Secure`, which a sibling host cannot set; else `keel-caller`. https is `httpsOf`; a client that spoofs
 * `x-forwarded-proto` over http only gets a `Secure` cookie its browser will not keep. Only a value of that
 * name that `keys` signed counts; any other is ignored, and the request is then cookieless: a write mints a token with
 * `ctx.random.id("Caller")`, signs it, and sets it `HttpOnly; SameSite=Lax; Path=/` (`issueCaller`), with
 * `Max-Age=<days × 86,400>` when the deployable sets `caller: { days }` (k.user Caller lifetime); a read gets `""`.
 */
export function callerOf(raw: Request, sv: Served): Caller {
  const https = httpsOf(raw, sv.secure, sv.origin);
  const { keys, days } = sv;
  const name = `${https ? "__Host-" : ""}${CALLER_COOKIE}=`;
  const sent = (raw.headers.get("cookie") ?? "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name) && keys.valid(x.slice(name.length)));
  if (sent !== undefined) return { id: keys.id(sent.slice(name.length)), set: "" };
  if (!isVerb(raw.method.toUpperCase())) return { id: "", set: "" };
  const value = keys.seal(sv.ctx.random.id("Caller"));
  const age = days === undefined ? "" : `; Max-Age=${days * 86_400}`;
  return { id: keys.id(value), set: `${name}${value}; Path=/; HttpOnly; SameSite=Lax${age}${https ? "; Secure" : ""}` };
}
