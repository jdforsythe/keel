import type { Ctx } from "@keel/ctx";
import type { CallerKeys } from "./CallerKeys.ts";

const TOKEN = /^[A-Za-z0-9-]{16,64}$/;
const WINDOW = 60_000;
const CEILING = 65_000;
const MAX_USER = 256;

/** A `user` an `x-keel-user` may carry: at most 256 characters, as `identify`'s answers (k.user). */
const fits = (user: string): boolean => user.length <= MAX_USER * 2 && Array.from(user).length <= MAX_USER;

/**
 * The caller-cookie keys under `secret` (`createApp({ secret })`), else under a key drawn from `random` (the app's
 * `ctx.random`: the platform's in production, the run's seed under `simulate`, so two replays of a run mint the same
 * callers), else under 32 random bytes drawn here, so a restart, or another instance without the same secret,
 * re-mints callers. Node's `crypto` is imported lazily like
 * `fs`, once, so signing, checking and hashing per request are synchronous. A value is valid when
 * it is `token.mac` with a well-formed token and the token's HMAC, compared in constant time. An `x-keel-user` value is
 * `<user base64url>.<expiry ms>.<mac>`, the HMAC over method, path, search, user, expiry, the receiving deployable's
 * name and the body's SHA-256 in lowercase hex, newline-joined, compared in constant time. `deployable` is this
 * server's own name (`createApp({ deployable })`, else `""`), the one a header it receives must be signed for.
 */
export async function callerSigner(secret?: string, deployable = "", random?: Ctx["random"]): Promise<CallerKeys> {
  const { createHash, createHmac, randomBytes, timingSafeEqual } = await import("node:crypto");
  const key =
    secret ??
    (random === undefined
      ? randomBytes(32)
      : createHash("sha256")
          .update(`${random.id("CallerKey")}${random.id("CallerKey")}`)
          .digest());
  const mac = (token: string): string => createHmac("sha256", key).update(token).digest("base64url");
  const same = (a: string, b: string): boolean => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  };
  // Only `user` may hold a newline; every field after it is newline-free, so the joined input reads one way.
  const claim = (method: string, url: string, user: string, expiry: string, to: string, body: string | Uint8Array) => {
    const u = new URL(url);
    const digest = createHash("sha256").update(body).digest("hex");
    return mac([method, u.pathname, u.search, user, expiry, to, digest].join("\n"));
  };
  return {
    id: (value) => (value === "" ? "" : createHash("sha256").update(value).digest("base64url")),
    seal: (token) => `${token}.${mac(token)}`,
    valid: (value) => {
      const dot = value.lastIndexOf(".");
      const token = value.slice(0, dot);
      return TOKEN.test(token) && same(value.slice(dot + 1), mac(token));
    },
    assert: (method, url, user, to, body, now) => {
      if (!fits(user)) return undefined;
      const expiry = String(Math.floor(now) + WINDOW);
      return `${Buffer.from(user).toString("base64url")}.${expiry}.${claim(method, url, user, expiry, to, body)}`;
    },
    user: (raw, now, body) => {
      const [encoded = "", expiry = "", sent = "", extra] = (raw.headers.get("x-keel-user") ?? "").split(".");
      const at = Number(expiry);
      if (extra !== undefined || !/^\d+$/.test(expiry) || !(at >= now && at <= now + CEILING)) return undefined;
      const user = Buffer.from(encoded, "base64url").toString();
      if (!fits(user) || Buffer.from(user).toString("base64url") !== encoded) return undefined;
      return same(sent, claim(raw.method, raw.url, user, expiry, deployable, body)) ? user : undefined;
    },
  };
}
