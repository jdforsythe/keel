import { LOOPBACK } from "@keel/compiler/inspect/LOOPBACK";
import { loopbackPeer } from "@keel/compiler/inspect/loopbackPeer";

/** The `Sec-Fetch-Site` values of this machine's own pages and of an address typed or opened directly. */
const OWN_SITE: ReadonlySet<string> = new Set(["same-origin", "none"]);

/** Whether a `Host` value names this machine with a port (`127.0.0.1:4100`, `localhost:4100`, `[::1]:4100`), nothing more. */
const loopbackHost = (host: string): boolean => {
  if (!URL.canParse(`http://${host}`)) return false;
  const u = new URL(`http://${host}`);
  return u.port !== "" && LOOPBACK.has(u.hostname) && u.host === host.toLowerCase();
};

/**
 * Whether a `local: true` route answers `raw` over a connection from `remote` (k.contract Local routes): `remote` is a
 * loopback address (an IPv4-mapped one too; undefined, no connection, is not), the `Host` is a loopback name with a
 * port, and `Sec-Fetch-Site` is `same-origin` or `none` (absent is refused). No forwarding header is read.
 */
export function localAllowed(raw: Request, remote: string | undefined): boolean {
  const host = raw.headers.get("host") ?? new URL(raw.url).host;
  return loopbackPeer(remote) && loopbackHost(host) && OWN_SITE.has(raw.headers.get("sec-fetch-site") ?? "");
}
