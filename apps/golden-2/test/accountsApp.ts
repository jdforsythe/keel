import type { SimCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import source from "../identity.server.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";

export const BASE = "http://localhost";
export const EMAIL = "ada.canary@example.com";
export const PASSWORD = "canary horse battery";
export const NAME = "Ada Canary";

type Fetch = { fetch(req: Request): Promise<Response> };

/** The real `api` deployable with the project's identity source over `server`, keeping every log line it writes. */
export async function accountsApp(server: SimCtx) {
  const lines: string[] = [];
  const app = await createApp({
    topology,
    routes: apiRoutes,
    ctx: server,
    deployable: "api",
    identity: source,
    log: { format: "json", write: (line: string) => lines.push(line) },
  });
  return { app, lines };
}

/** One answer as a test reads it: status, `location`, the cookies it set and its body text. */
export type Seen = { status: number; location: string | null; cookies: string[]; text: string };

/**
 * A browser on the app's origin: it keeps the cookies the app sets (a `Max-Age=0` or empty value removes one), sends
 * them back, marks every request same-origin, and follows a 303 with a GET as a browser does.
 */
export function browser(app: Fetch) {
  const jar = new Map<string, string>();
  const keep = (res: Response): string[] => {
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const [pair = ""] = c.split(";");
      const at = pair.indexOf("=");
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      if (value === "" || /;\s*max-age=0/i.test(c)) jar.delete(name);
      else jar.set(name, value);
    }
    return set;
  };
  const cookie = (): string => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  async function send(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
    const headers = new Headers({ accept: "text/html", "sec-fetch-site": "same-origin", ...init.headers });
    if (jar.size > 0) headers.set("cookie", cookie());
    const req = new Request(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
    });
    const res = await app.fetch(req);
    const cookies = keep(res);
    return { status: res.status, location: res.headers.get("location"), cookies, text: await res.text() };
  }
  return {
    jar,
    send,
    /** A native form post of `fields` to `path`, then the GET of the page it redirects to. */
    async post(path: string, fields: Record<string, string>): Promise<{ posted: Seen; page: Seen | null }> {
      const body = new URLSearchParams(fields).toString();
      const posted = await send(path, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE },
        body,
      });
      const page = posted.status === 303 && posted.location !== null ? await send(posted.location) : null;
      return { posted, page };
    },
    /** A JSON call as the app's own scripts make it. */
    json(method: string, path: string, extra: Record<string, string> = {}, body?: unknown) {
      return send(path, {
        method,
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", ...extra },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
  };
}
