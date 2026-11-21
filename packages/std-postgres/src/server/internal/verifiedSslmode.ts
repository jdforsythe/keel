/**
 * `url` with `sslmode=require` or `sslmode=prefer` written as `sslmode=verify-full`, which is how `pg` reads both: the
 * certificate and host name are verified. `pg` prints a multi-line security warning at the first connect with either
 * mode spelled out, outside `docs/OUTPUT.md`; the explicit mode connects the same and prints nothing. A URL with
 * `uselibpqcompat`, another mode, or no mode, and a string that is not a URL, comes back unchanged.
 */
export function verifiedSslmode(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const mode = u.searchParams.get("sslmode");
  if ((mode !== "require" && mode !== "prefer") || u.searchParams.has("uselibpqcompat")) return url;
  u.searchParams.set("sslmode", "verify-full");
  return u.href;
}
