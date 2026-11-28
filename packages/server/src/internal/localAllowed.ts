import { LOOPBACK } from "@keel/compiler/inspect/LOOPBACK";
import { loopbackPeer } from "@keel/compiler/inspect/loopbackPeer";

/** The `Sec-Fetch-Site` values of this machine's own pages and of an address typed or opened directly. */
const OWN_SITE: ReadonlySet<string> = new Set(["same-origin", "none"]);

/**
 * Whether a `Host` value names this machine with a port (`127.0.0.1:4100`, `localhost:4100`, `[::1]:4100`), nothing
 * more; port 0, where no server listens, does not.
 */
const loopbackHost = (host: string): boolean => {
  if (!URL.canParse(`http://${host}`)) return false;
  const u = new URL(`http://${host}`);
  return u.port !== "" && u.port !== "0" && LOOPBACK.has(u.hostname) && u.host === host.toLowerCase();
};

/** The authority of a request target in absolute form (`http://127.0.0.1:4100/tools`), as written; else undefined. */
const authorityOf = (target: string | undefined): string | undefined =>
  target === undefined ? undefined : /^https?:\/\/([^/?#]*)/i.exec(target)?.[1];

/**
 * Whether a `local: true` route answers `raw` over a connection from `remote` (k.contract Local routes): `remote` is a
 * loopback address (an IPv4-mapped one too; undefined, no connection, is not), the host is a loopback name with a
 * port (the authority of a `target` in absolute form, as the connection received it, whatever `Host` says, as RFC
 * 9112 gives it; else the `Host`), `Sec-Fetch-Site` is `same-origin` or `none` (absent is refused), and it carries no
 * `x-keel-forwarded`, any value: every request a deployable forwards or a server's `service` call sends carries it
 * (k.topology Calls and peers). No forwarding header (`X-Forwarded-For`, `Forwarded`) is read.
 */
export function localAllowed(raw: Request, remote: string | undefined, target?: string): boolean {
  const host = authorityOf(target) ?? raw.headers.get("host") ?? new URL(raw.url).host;
  return (
    !raw.headers.has("x-keel-forwarded") &&
    loopbackPeer(remote) &&
    loopbackHost(host) &&
    OWN_SITE.has(raw.headers.get("sec-fetch-site") ?? "")
  );
}
