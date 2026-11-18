import type { CallerKeys } from "./CallerKeys.ts";

const TOKEN = /^[A-Za-z0-9-]{16,64}$/;

/**
 * The caller-cookie keys under `secret` (`createApp({ secret })`), else under 32 random bytes drawn here, so
 * a restart, or another instance without the same secret, re-mints callers. Node's `crypto` is imported lazily like
 * `fs`, once, so signing, checking and hashing per request are synchronous. A value is valid when
 * it is `token.mac` with a well-formed token and the token's HMAC, compared in constant time. An `x-keel-user` value is
 * `<user base64url>.<expiry ms>.<mac>`, the HMAC over method, path, search, user and expiry, compared in constant time.
 */
export async function callerSigner(secret?: string): Promise<CallerKeys> {
  const { createHash, createHmac, randomBytes, timingSafeEqual } = await import("node:crypto");
  const key = secret ?? randomBytes(32);
  const mac = (token: string): string => createHmac("sha256", key).update(token).digest("base64url");
  const same = (a: string, b: string): boolean => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  };
  // What a module call's `x-keel-user` signs: no newline occurs in a method, a URL path or a search.
  const claim = (method: string, url: string, body: string): string => {
    const u = new URL(url);
    return mac(`${method}\n${u.pathname}\n${u.search}\n${body}`);
  };
  return {
    id: (value) => (value === "" ? "" : createHash("sha256").update(value).digest("base64url")),
    seal: (token) => `${token}.${mac(token)}`,
    valid: (value) => {
      const dot = value.lastIndexOf(".");
      const token = value.slice(0, dot);
      return TOKEN.test(token) && same(value.slice(dot + 1), mac(token));
    },
    assert: (method, url, user, now) => {
      const body = `${Buffer.from(user).toString("base64url")}.${Math.floor(now) + 60_000}`;
      return `${body}.${claim(method, url, body)}`;
    },
    user: (raw, now) => {
      const sent = raw.headers.get("x-keel-user") ?? "";
      const dot = sent.lastIndexOf(".");
      const body = sent.slice(0, dot);
      const [user = "", expiry = "", extra] = body.split(".");
      const fresh = extra === undefined && /^\d+$/.test(expiry) && Number(expiry) >= now;
      return fresh && same(sent.slice(dot + 1), claim(raw.method, raw.url, body))
        ? Buffer.from(user, "base64url").toString()
        : undefined;
    },
  };
}
