/**
 * Whether a write (POST, PUT, PATCH, DELETE) may run (CSRF, RFC 0022): `Sec-Fetch-Site` is `same-origin` or `none`;
 * or `Origin` is the public origin (`createApp({ origin })`, else the request's own); or it carries `accept: application/json` and `x-keel: 1` (a custom header
 * a cross-site page cannot send without a CORS preflight, which is never granted); or it has neither `Origin` nor
 * `Sec-Fetch-Site` (not a browser, so no ambient credentials to ride). Anything else is refused.
 */
export function sameSite(raw: Request, publicOrigin: string | undefined): boolean {
  const h = raw.headers;
  const site = h.get("sec-fetch-site");
  const origin = h.get("origin");
  if (site === "same-origin" || site === "none") return true;
  if (origin !== null && origin === (publicOrigin ?? new URL(raw.url).origin)) return true;
  if (h.get("x-keel") === "1" && (h.get("accept") ?? "").includes("application/json")) return true;
  return site === null && origin === null;
}
