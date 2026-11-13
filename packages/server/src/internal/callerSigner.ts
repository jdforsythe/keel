import type { CallerKeys } from "./CallerKeys.ts";

const TOKEN = /^[A-Za-z0-9-]{16,64}$/;

/**
 * The caller-cookie keys under `secret` (`createApp({ secret })`), else under 32 random bytes drawn here, so
 * a restart, or another instance without the same secret, re-mints callers. Node's `crypto` is imported lazily like
 * `fs`, once, so signing, checking and hashing per request are synchronous. A value is valid when
 * it is `token.mac` with a well-formed token and the token's HMAC, compared in constant time.
 */
export async function callerSigner(secret?: string): Promise<CallerKeys> {
  const { createHash, createHmac, randomBytes, timingSafeEqual } = await import("node:crypto");
  const key = secret ?? randomBytes(32);
  const mac = (token: string): string => createHmac("sha256", key).update(token).digest("base64url");
  return {
    id: (value) => (value === "" ? "" : createHash("sha256").update(value).digest("base64url")),
    seal: (token) => `${token}.${mac(token)}`,
    valid: (value) => {
      const dot = value.lastIndexOf(".");
      const token = value.slice(0, dot);
      const sent = Buffer.from(value.slice(dot + 1));
      const want = Buffer.from(mac(token));
      return TOKEN.test(token) && sent.length === want.length && timingSafeEqual(sent, want);
    },
  };
}
