/**
 * The `cookie` header value that carries `token` as the caller cookie (k.server) on a request to `url`:
 * `__Host-keel-caller=<token>` to an https url, `keel-caller=<token>` to any other, as `keel session ingest` sends
 * its own token. `undefined` for an absent or empty token: the request then carries no credential.
 */
export function callerCookie(url: string, token: string | undefined): string | undefined {
  if (token === undefined || token === "") return undefined;
  return `${url.startsWith("https:") ? "__Host-keel-caller" : "keel-caller"}=${token}`;
}
