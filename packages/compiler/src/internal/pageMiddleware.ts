import type { IncomingMessage, ServerResponse } from "node:http";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void) => void;

/** Paths a document request never takes: Vite's own, Keel's, and installed packages. */
const NOT_A_PAGE = /^\/(?:@|__|node_modules\/)/;

/**
 * The `keel dev` document of a `client` deployable (k.head Document source): a GET or HEAD that accepts `text/html`,
 * whose path is no file (its last segment has no `.`) and none of Vite's or Keel's, is answered with `html(url)`, the
 * generated `index.html` after Vite's transform, 200 and `no-cache`, so the client router resolves the path; anything
 * else, or with `html` giving undefined (no `client` deployable), goes on. The project's own `index.html` is never read.
 */
export function pageMiddleware(html: (url: string) => Promise<string | undefined>): Middleware {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void): Promise<void> => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";
    const page =
      (req.method === "GET" || req.method === "HEAD") &&
      (req.headers.accept ?? "").includes("text/html") &&
      !NOT_A_PAGE.test(path) &&
      !(path.split("/").pop() ?? "").includes(".");
    const text = page ? await html(url) : undefined;
    if (text === undefined) return next();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : text);
  };
  return (req, res, next) => void handle(req, res, next).catch(next);
}
