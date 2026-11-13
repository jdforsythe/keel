/** Longest source key held: an address fits; a header of any length does not grow the window's map. */
const MAX_KEY = 64;
const field = (v: unknown, key: string): unknown =>
  typeof v === "object" && v !== null ? Reflect.get(v, key) : undefined;

/**
 * Where a CSP report came from (k.security Reports): the last `x-forwarded-for` entry (the address the nearest proxy
 * saw), else the peer address `@hono/node-server` gives in `env.incoming.socket`, else undefined; at most its first 64
 * characters. Counted per window, never logged.
 */
export function reportSource(raw: Request, env: unknown): string | undefined {
  const last = raw.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  if (last !== undefined && last !== "") return last.slice(0, MAX_KEY);
  const peer = field(field(field(env, "incoming"), "socket"), "remoteAddress");
  return typeof peer === "string" && peer !== "" ? peer.slice(0, MAX_KEY) : undefined;
}
