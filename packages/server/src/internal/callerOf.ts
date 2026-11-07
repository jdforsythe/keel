import type { Ctx } from "@keel/ctx";
import { CALLER_COOKIE } from "./CALLER_COOKIE.ts";
import type { Caller } from "./Caller.ts";
import { isVerb } from "./isVerb.ts";

const TOKEN = /^[A-Za-z0-9-]{16,64}$/;

/**
 * The caller of `raw`: its well-formed `keel-caller` cookie, else a token minted with `ctx.random.id("Caller")` for a write
 * (`fresh`, issued on its response by `issueCaller`), else `""` (a cookieless read matches no committed entry), with
 * its `id` from `hash` (`callerHasher`, RFC 0054).
 */
export function callerOf(raw: Request, ctx: Ctx, hash: (token: string) => string): Caller {
  const prefix = `${CALLER_COOKIE}=`;
  const pair = (raw.headers.get("cookie") ?? "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(prefix));
  const sent = pair?.slice(prefix.length);
  if (sent !== undefined && TOKEN.test(sent)) return { token: sent, fresh: false, id: hash(sent) };
  const write = isVerb(raw.method.toUpperCase());
  const token = write ? ctx.random.id("Caller") : "";
  return { token, fresh: write, id: hash(token) };
}
