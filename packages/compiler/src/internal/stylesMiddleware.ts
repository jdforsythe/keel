import type { IncomingMessage, ServerResponse } from "node:http";
import { STYLES_PATH } from "../entry/STYLES_PATH.ts";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void) => void;

/**
 * The `keel dev` stylesheet (k.head Server): a GET or HEAD of `/@keel/styles.css`, `?d=<name>` naming the deployable, is
 * answered with `css(name)` as `text/css`, `no-cache`, so a document styles its first paint before any script runs;
 * `css` giving undefined (no such deployable) is a 404. Any other path goes on.
 */
export function stylesMiddleware(css: (d: string | undefined) => Promise<string | undefined>): Middleware {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://keel.invalid");
    if (url.pathname !== STYLES_PATH || (req.method !== "GET" && req.method !== "HEAD")) return next();
    const text = await css(url.searchParams.get("d") ?? undefined);
    if (text === undefined) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return void res.end(req.method === "HEAD" ? undefined : `no deployable ${url.searchParams.get("d") ?? ""}`);
    }
    res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : text);
  };
  return (req, res, next) => void handle(req, res, next).catch(next);
}
