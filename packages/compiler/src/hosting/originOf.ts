/**
 * The origin of `value` when it is an http(s) origin (k.hosting): scheme, host and optional port, optionally one
 * trailing `/`, and nothing else (no path, query, fragment, credentials, whitespace or `*`); the host is a DNS name of
 * letter-digit-hyphen labels (punycode included), an IPv4 address or a bracketed IPv6 address. Returns the serialized
 * origin (`https://App.test:443/` -> `https://app.test`), else undefined. Used for `KEEL_PEER_<NAME>` at build and
 * each `KEEL_ALLOW_ORIGINS` entry.
 */
export function originOf(value: string): string | undefined {
  if (/[*?#@\\\s]/.test(value)) return undefined;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return undefined;
  }
  return (u.protocol === "http:" || u.protocol === "https:") &&
    u.pathname === "/" &&
    /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*|\[[\da-f:.]+\])$/.test(u.hostname) &&
    /^https?:\/\/[^/]+\/?$/i.test(value)
    ? u.origin
    : undefined;
}
