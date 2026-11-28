/**
 * The fingerprint of a thrown value (k.serverlog Thrown values): the first 32 bits of HMAC-SHA-256 over its input (its
 * class, a line feed and its text), as 8 lowercase hex digits, keyed by `secret` (`KEEL_SECRET`), else by 32 random
 * bytes drawn here, at start, which leave the app's `ctx.random` sequence as it is. Equal inputs under one key give one
 * fingerprint, across the processes that share the secret; no input is recovered from one without the key. Node's
 * `crypto` is imported lazily, once, so each fingerprint is synchronous.
 */
export async function fingerprintOf(secret: string | undefined): Promise<(input: string) => string> {
  const { createHmac, randomBytes } = await import("node:crypto");
  const key = secret !== undefined && secret !== "" ? secret : randomBytes(32);
  return (input) => createHmac("sha256", key).update(input).digest("hex").slice(0, 8);
}
