/**
 * The function from a `keel-caller` token to the opaque `caller` loaders and actions see (k.server Server state,
 * RFC 0054): its SHA-256 as base64url without padding, `""` for `""`. Stored tx `meta.caller` therefore never holds
 * the cookie: whoever reads storage learns ids, and an id cannot be sent back as a cookie. Loaded once at `createApp`
 * (Node's `crypto`, imported lazily like `fs`), so hashing per request is synchronous.
 */
export async function callerHasher(): Promise<(token: string) => string> {
  const { createHash } = await import("node:crypto");
  return (token) => (token === "" ? "" : createHash("sha256").update(token).digest("base64url"));
}
