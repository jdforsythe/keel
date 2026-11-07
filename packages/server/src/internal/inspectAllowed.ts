import { LOOPBACK } from "@keel/compiler/inspect/LOOPBACK";
import { originListed } from "@keel/compiler/inspect/originListed";

/**
 * Whether the dev inspect endpoint answers `raw` (k.cli Inspect, RFC 0022): the request's own host is loopback or
 * listed in `origins` (no DNS rebinding), and its `Origin` is the request's own origin or listed. An absent `Origin`
 * is admitted for a GET (a same-origin navigation or a non-browser client) and refused for any other method.
 * `allow` is the origin to echo for a cross-origin read.
 */
export function inspectAllowed(raw: Request, origins: readonly string[]): { ok: boolean; allow: string | undefined } {
  const self = new URL(raw.url);
  const origin = raw.headers.get("origin");
  const hostOk = LOOPBACK.has(self.hostname) || originListed(origins, self.origin);
  if (!hostOk) return { ok: false, allow: undefined };
  if (origin === null) return { ok: raw.method === "GET", allow: undefined };
  if (origin === self.origin) return { ok: true, allow: undefined };
  return originListed(origins, origin) ? { ok: true, allow: origin } : { ok: false, allow: undefined };
}
