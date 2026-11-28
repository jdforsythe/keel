import type { Clock, Net } from "@keel/ctx";

/** What a browser front sends through and signs with. */
interface FrontSetup {
  /** The page's origin: the only one whose requests carry the jar. */
  readonly origin: string;
  /** Where a request goes: `ctx.net`, or the app itself when the net routes nothing. */
  readonly send: (req: Request) => Promise<Response>;
  /** The net the front stands for: requests to other origins and `online()` go there unchanged. */
  readonly net: Net;
  /** The clock a cookie's `Expires` is read against. */
  readonly clock: Clock;
  /** The `x-keel-user` value a request to the origin carries (`renderRoute` `user` with `app`), else none. */
  /** Hears each request as it enters `send` (or `net`), after the jar and `x-keel-user` are set (k.requests). */
  readonly log?: ((req: Request) => void) | undefined;
  readonly sign?: ((method: string, url: string, body: Uint8Array) => string | undefined) | undefined;
}

/** One `Set-Cookie` line applied to `jar` (k.mount Testing): `name=value` kept, a past expiry removes it. */
function apply(jar: Map<string, string>, line: string, now: number): void {
  const [pair = "", ...attrs] = line.split(";");
  const at = pair.indexOf("=");
  const name = at < 0 ? "" : pair.slice(0, at).trim();
  if (name === "") return;
  let gone = false;
  for (const attr of attrs) {
    const eq = attr.indexOf("=");
    const key = (eq < 0 ? attr : attr.slice(0, eq)).trim().toLowerCase();
    const value = eq < 0 ? "" : attr.slice(eq + 1).trim();
    if (key === "max-age" && /^-?\d+$/.test(value)) gone = Number(value) <= 0;
    else if (key === "expires") {
      const when = Date.parse(value);
      if (!Number.isNaN(when) && when < now) gone = true;
    }
  }
  if (gone) jar.delete(name);
  else jar.set(name, pair.slice(at + 1).trim());
}

/**
 * One browser's front on the net (k.mount Testing): a `Net` whose requests to `origin` enter `send` with `cookie` set to
 * the jar's `name=value` pairs (replacing any the request had) and, with `sign`, `x-keel-user`; each `set-cookie` line
 * of the answer is applied to the jar. Requests to any other origin go to `net` unchanged. The jar is the harness's
 * own, one per front.
 */
export function browserFront(setup: FrontSetup): Net {
  const jar = new Map<string, string>();
  return {
    online: () => setup.net.online(),
    fetch: async (req) => {
      if (new URL(req.url).origin !== setup.origin) {
        setup.log?.(req);
        return setup.net.fetch(req);
      }
      const headers = new Headers(req.headers);
      headers.delete("cookie");
      if (jar.size > 0) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
      if (setup.sign !== undefined) {
        const body = req.body === null ? new Uint8Array(0) : new Uint8Array(await req.clone().arrayBuffer());
        const signed = setup.sign(req.method, req.url, body);
        if (signed !== undefined) headers.set("x-keel-user", signed);
      }
      const sent = new Request(req, { headers });
      setup.log?.(sent);
      const res = await setup.send(sent);
      const now = setup.clock.now();
      for (const line of res.headers.getSetCookie()) apply(jar, line, now);
      return res;
    },
  };
}
