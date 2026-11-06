import { originMatches } from "./originMatches.ts";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Whether the dev inspect endpoint answers `raw` (k.cli Inspect, RFC 0022): the request's own host is loopback or
 * listed in `origins` (no DNS rebinding), and its `Origin` is absent (a same-origin navigation or a non-browser
 * client), the request's own origin, or listed. `allow` is the origin to echo for a cross-origin read.
 */
export function inspectAllowed(raw: Request, origins: readonly string[]): { ok: boolean; allow: string | undefined } {
  const self = new URL(raw.url);
  const origin = raw.headers.get("origin");
  const hostOk = LOOPBACK.has(self.hostname) || originMatches(origins, self.origin);
  if (!hostOk) return { ok: false, allow: undefined };
  if (origin === null || origin === self.origin) return { ok: true, allow: undefined };
  return originMatches(origins, origin) ? { ok: true, allow: origin } : { ok: false, allow: undefined };
}
