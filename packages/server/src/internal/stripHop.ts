/** Hop-by-hop headers (RFC 9110 7.6.1) and the ones a forwarded message recomputes. */
const HOP = /^(connection|keep-alive|transfer-encoding|te|trailer|upgrade|expect|host|content-length|proxy-.*)$/;

/** A copy of `headers` without the `HOP` ones, those named in `connection`, and `more`. */
export function stripHop(headers: Headers, more: readonly string[] = []): Headers {
  const out = new Headers(headers);
  const named = (out.get("connection") ?? "").split(",").map((n) => n.trim().toLowerCase());
  for (const h of [...out.keys()]) if (HOP.test(h) || named.includes(h) || more.includes(h)) out.delete(h);
  return out;
}
