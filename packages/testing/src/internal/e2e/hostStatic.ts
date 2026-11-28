import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import type { StaticHost } from "./StaticHost.ts";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

const isFile = (p: string): boolean => existsSync(p) && statSync(p).isFile();

/**
 * Serves `dir` (a `static` or unserved `client` deployable's `dist/<name>/`) on 127.0.0.1 as k.hosting says a static
 * host does: a file at its path; for `static` `<path>/index.html`, else `404.html` with 404; for `client` `index.html`
 * with 200 for a path that is no file; `assets/*` cached immutable and the rest `no-cache`; each document with
 * `csp.txt` as its `content-security-policy` header.
 */
export function hostStatic(name: string, dir: string, adapter: "static" | "client"): Promise<StaticHost> {
  const policy = isFile(join(dir, "csp.txt")) ? readFileSync(join(dir, "csp.txt"), "utf8").trim() : undefined;
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://host").pathname);
    const local = normalize(join(dir, path));
    if (local !== dir && !local.startsWith(dir.endsWith(sep) ? dir : dir + sep)) {
      res.writeHead(400).end();
      return;
    }
    let file = isFile(local) ? local : join(local, "index.html");
    let status = 200;
    if (!isFile(file)) {
      file = join(dir, adapter === "static" ? "404.html" : "index.html");
      status = adapter === "static" ? 404 : 200;
    }
    if (!isFile(file)) {
      res.writeHead(404).end();
      return;
    }
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    const headers: Record<string, string> = {
      "content-type": type,
      "cache-control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    };
    if (type.startsWith("text/html") && policy !== undefined) headers["content-security-policy"] = policy;
    res.writeHead(status, headers);
    res.end(req.method === "HEAD" ? undefined : readFileSync(file));
  });
  return new Promise((done, failed) => {
    server.once("error", failed);
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      const port = typeof a === "object" && a !== null ? a.port : 0;
      done({
        name,
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((closed) => {
            server.closeAllConnections();
            server.close(() => closed());
          }),
      });
    });
  });
}
