import type { IncomingMessage, ServerResponse } from "node:http";

type App = { fetch(req: Request): Promise<Response> };
type Served = { readonly app: App; served(path: string): boolean };

/**
 * The `keel dev` middleware (k.topology Local topology): a request whose path a `node` deployable's route matches is
 * answered by that deployable's dev app, streaming its body (event streams too); anything else goes on to Vite.
 * `load` gives the dev apps (`DEV_ENTRY`), loaded once and again after `reset`.
 */
export function devMiddleware(load: () => Promise<readonly Served[]>): {
  handle(req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void): void;
  reset(): void;
} {
  let apps: Promise<readonly Served[]> | undefined;
  const handle = async (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void): Promise<void> => {
    apps ??= load();
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pick = (await apps).find((a) => a.served(url.pathname));
    if (pick === undefined) return next();
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) headers.append(k, one);
    const ac = new AbortController();
    res.on("close", () => ac.abort());
    const chunks: Uint8Array[] = [];
    if (req.method !== "GET" && req.method !== "HEAD")
      for await (const c of req) if (c instanceof Uint8Array) chunks.push(c);
    const body = chunks.length === 0 ? null : Buffer.concat(chunks);
    const request = new Request(url, { method: req.method ?? "GET", headers, signal: ac.signal, body });
    const answer = await pick.app.fetch(request);
    const out: Record<string, string | string[]> = {};
    answer.headers.forEach((v, k) => {
      if (k !== "set-cookie") out[k] = v;
    });
    const cookies = answer.headers.getSetCookie();
    if (cookies.length > 0) out["set-cookie"] = cookies;
    res.writeHead(answer.status, out);
    if (answer.body === null) return void res.end();
    for await (const chunk of answer.body) res.write(chunk);
    res.end();
  };
  return {
    handle: (req, res, next) => void handle(req, res, next).catch(next),
    reset: () => {
      apps = undefined;
    },
  };
}
