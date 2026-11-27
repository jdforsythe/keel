/** A host and an optional port: a name of URL host characters or a bracketed IPv6 address, then `:<digits>`. */
const SHAPE = /^(?:[A-Za-z0-9._~!$&'()*+,;=%-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;

/**
 * The one `Host` of a request from its raw header list (`rawHeaders`, name and value in turn), when `server.mjs` can
 * read it as a host and optional port and reads it back unchanged (k.contract Local routes); `undefined` for none, an
 * empty one, more than one, or one it cannot read (`a b`, `[::1`, `127.0.0.1 :9100`, `[::ffff:127.0.0.1]:9100`, a port
 * of 0, where no server listens).
 */
export function readableHost(rawHeaders: readonly string[]): string | undefined {
  const values = rawHeaders.filter((_, i) => i % 2 === 1 && rawHeaders[i - 1]?.toLowerCase() === "host");
  const host = values.length === 1 ? values[0] : undefined;
  if (host === undefined || !SHAPE.test(host) || !URL.canParse(`http://${host}/`)) return undefined;
  const name = host.replace(/:\d+$/, "").toLowerCase();
  const u = new URL(`http://${host}/`);
  return u.hostname === name && u.port !== "0" ? host : undefined;
}
