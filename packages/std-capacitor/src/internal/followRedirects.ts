import type { Hop } from "./Hop.ts";

const REDIRECT = [301, 302, 303, 307, 308];
/** The request headers that describe a body, dropped with it. */
const BODY_HEADERS = ["content-encoding", "content-language", "content-location", "content-type"];
const MAX = 20;
const failed = (): TypeError => new TypeError("network request failed");

/**
 * A shell `net.fetch`'s redirects, followed by the driver because the native client follows none (k.shell Origins).
 * Each hop, `first` included, is sent with `send` only when `allowed` takes its URL; a refused one rejects with a
 * `TypeError` naming no URL and is not sent. `mode` is the request's `redirect`:
 * - `manual`: the first response resolves as it came.
 * - `error`: a 301, 302, 303, 307 or 308 rejects with a `TypeError`.
 * - `follow`: such a response with a `location` is one more hop to that URL, resolved against the hop's, at most 20;
 *   the 21st rejects with a `TypeError`. A 303 unless the method is `HEAD`, and a 301 or 302 after a `POST`, continue
 *   as a `GET` with no body and no header describing one; any other hop repeats method and body. A hop to another
 *   origin drops `authorization`. Without a `location` the response resolves as it came.
 * `drop` releases a response that is not returned.
 */
export async function followRedirects<R extends { readonly status: number; readonly headers: Headers }>(
  first: Hop,
  mode: RequestRedirect,
  allowed: (url: string) => boolean,
  send: (hop: Hop) => Promise<R>,
  drop: (res: R) => void,
): Promise<R> {
  let hop = first;
  for (let followed = 0; ; followed++) {
    if (!allowed(hop.url)) throw failed();
    const res = await send(hop);
    if (mode === "manual" || !REDIRECT.includes(res.status)) return res;
    const to = res.headers.get("location");
    if (mode !== "error" && to === null) return res;
    drop(res);
    if (mode === "error" || to === null || followed === MAX || !URL.canParse(to, hop.url)) throw failed();
    const url = new URL(to, hop.url);
    url.hash = "";
    const headers = new Headers(hop.headers);
    const get = (res.status === 303 && hop.method !== "HEAD") || (res.status < 303 && hop.method === "POST");
    if (get) for (const name of BODY_HEADERS) headers.delete(name);
    if (url.origin !== new URL(hop.url).origin) headers.delete("authorization");
    hop = { url: url.href, method: get ? "GET" : hop.method, headers, body: get ? false : hop.body };
  }
}
