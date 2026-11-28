/**
 * Whether `raw` counts as https (k.security, the caller cookie's rule, which HSTS also follows): `secure` when given,
 * else the public `origin`'s scheme when given, else an https request URL or a first `x-forwarded-proto` value of
 * `https` (what a TLS-terminating proxy sends). The header only upgrades: it never makes an https URL count as http.
 */
export function httpsOf(raw: Request, secure: boolean | undefined, origin: string | undefined): boolean {
  return (
    secure ??
    (origin === undefined ? undefined : origin.startsWith("https:")) ??
    (new URL(raw.url).protocol === "https:" ||
      (raw.headers.get("x-forwarded-proto") ?? "").split(",")[0]?.trim().toLowerCase() === "https")
  );
}
